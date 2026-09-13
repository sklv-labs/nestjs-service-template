# Auth design

Status: **design, not implemented.** The vehicle for testing the approach in
[v1-architecture.md](./v1-architecture.md) — it was chosen because it has a real invariant spanning
rows, a secret that must never escape, and an extension axis (providers) that will be exercised.

## Scope

In: email + password, third-party providers (Google, GitHub, and whatever comes next), sessions,
linking and unlinking methods.

Deferred, and named so they are not accidentally assumed: email verification delivery, password
reset, MFA/TOTP, passkeys, rate limiting, roles and permissions, account deletion, session listing.
The model leaves room for each; none is designed here.

## Where it lives

One feature, `src/identity/`, owning the user aggregate, its sign-in methods and the flows. The
existing `users` feature folds into it.

The alternative — `users` and `auth` as separate features, with `auth` depending on `users` — was
rejected because they share one aggregate and one transaction: linking a Google account mutates the
user, so `auth` would exist only to reach into another feature's aggregate. Sessions are separable
and live in `identity/sessions/` as their own thing.

## The modelling decision

A `User` is who someone is. A sign-in method is how they prove it. One user has many methods, and
methods are added and removed over a lifetime — so they are not columns on `users`.

**Group methods by shape, not by concept.** OAuth providers are homogeneous with each other and
heterogeneous with everything else, so:

| Table                                              | Extends by                                             |
| -------------------------------------------------- | ------------------------------------------------------ |
| `oauth_accounts` — every OIDC/OAuth provider       | a config entry and a provider class. **No migration.** |
| `password_credentials` — the one password per user | n/a                                                    |
| `webauthn_credentials` — later                     | a migration, because the shape is genuinely different  |

The obvious alternative — a single `auth_identities` table with `provider`, a nullable `secret` and
a JSONB blob — is rejected. No constraint can express "if provider is `password` then the hash is
not null", every new method adds columns meaningless to the others, and the blob puts the shape
beyond the reach of the schema. The point of having a database schema is that it enforces shape.

## Tables

```
users
  id                uuid pk                      -- uuidv7, generated in the domain
  email             varchar(320) not null unique -- normalised: trimmed, lower-cased
  email_verified_at timestamptz null
  status            user_status not null         -- active | suspended
  version           integer not null default 0   -- optimistic lock
  created_at        timestamptz not null
  updated_at        timestamptz not null

password_credentials
  user_id      uuid pk references users(id) on delete cascade
  hash         text not null
  algorithm    text not null                     -- 'argon2id'
  params       jsonb not null                    -- the cost parameters this hash was made with
  updated_at   timestamptz not null

oauth_accounts
  id                  uuid pk
  user_id             uuid not null references users(id) on delete cascade
  provider            text not null              -- 'google' | 'github' | …
  provider_account_id text not null              -- the provider's stable subject id
  email               varchar(320) null          -- as the provider reported it, for display only
  linked_at           timestamptz not null
  unique (provider, provider_account_id)
  index  (user_id)

refresh_tokens
  id          uuid pk
  user_id     uuid not null references users(id) on delete cascade
  family_id   uuid not null                      -- rotation chain; revoked as a unit
  token_hash  text not null unique               -- sha-256 of the token; never the token itself
  expires_at  timestamptz not null
  used_at     timestamptz null
  revoked_at  timestamptz null
  created_at  timestamptz not null
  index (user_id), index (family_id)
```

`provider_account_id` is the provider's **stable subject** — Google's `sub`, GitHub's numeric `id`
— never the email. Emails change hands; subjects do not.

Email is normalised in the domain (trim, lower-case) rather than by `citext`, so the rule is
visible where the rest of the rules live, and the unique index applies to the stored value.

## The aggregate

`User` is the root; its sign-in methods are children, loaded and saved with it.

```
User (root)
├── email, emailVerifiedAt, status, version
├── password: PasswordCredential | null
└── oauthAccounts: OAuthAccount[]
```

Invariants, all enforced at the root:

1. **An active user always has at least one sign-in method.** Unlinking the last one is refused.
   This is the invariant that justifies an aggregate at all: it spans rows, so no single row
   constraint can express it, and getting it wrong locks a person out of their account permanently.
2. **At most one password credential.**
3. **At most one account per `(provider, providerAccountId)`** — also a database unique constraint,
   because the aggregate cannot see another transaction.
4. **A suspended user cannot sign in**, whatever method is presented.

Behaviour:

```ts
User.register(props: { email: Email; now: Date }): User
User.restore(snapshot: UserSnapshot): User

user.setPassword(hash: PasswordHash, now: Date): void
user.linkOAuth(profile: ProviderProfile, now: Date): void      // refuses a duplicate provider link
user.unlink(method: MethodRef, now: Date): void                // refuses the last one
user.verifyEmail(now: Date): void
user.suspend(now: Date): void
user.snapshot(): UserSnapshot
```

Verifying a password is **not** a method on the aggregate: it needs the hashing port, and the
entity must not depend on infrastructure. The handler loads the user, asks the `PasswordHasher`
port to verify against `user.password`, and the aggregate decides only what a successful or failed
attempt _means_.

Persistence is whole-aggregate. Child collections are replaced wholesale inside the transaction; a
user has fewer than ten methods.

## Extending to a new provider

The flows never branch on provider. A provider implements one port and appears in a registry.

```ts
type ProviderProfile = {
  provider: ProviderId;
  externalId: string; // stable subject
  email: Email | null;
  emailVerified: boolean; // whether the *provider* asserts it
  displayName: string | null;
};

interface OAuthProvider {
  readonly id: ProviderId;
  authorizationUrl(p: { state: string; redirectUri: string; codeChallenge: string }): string;
  exchange(p: {
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<ProviderProfile>;
}
```

Adding GitLab is a class plus a config entry. Adding passkeys is not a provider — different shape,
different table, its own flow.

## Flows

### Register (email + password)

Normalise email → hash password → `User.register` → `user.setPassword` → save → issue tokens.
Email starts unverified; delivery is deferred.

### Sign in (email + password)

Load by email → verify hash → issue tokens. **One failure error for every cause**, and the
verification runs against a dummy hash when no user exists, so a wrong email and a wrong password
cost the same time. A suspended user gets the same error.

Rehash opportunistically: if the stored parameters are below current policy, the successful
verification is the moment to upgrade the hash.

### Sign in with a provider

`GET /auth/providers/:provider/authorize` issues `state` (CSRF) and PKCE `code_verifier`, stores
them against the browser, and redirects. The callback exchanges the code for a `ProviderProfile`,
then:

1. `(provider, externalId)` already linked → sign that user in.
2. Not linked, provider asserts a **verified** email matching an existing user → link and sign in.
3. Not linked, email matches an existing user but the provider does **not** assert verification →
   **refuse** (`OAUTH_LINK_REQUIRES_SIGN_IN`). Signing in another way and linking explicitly is the
   route through.
4. No match → create the user, mark the email verified only if the provider asserts it, link.

Step 3 is the account-takeover defence: auto-linking on an unverified email lets anyone who can
create an account at a careless provider claim the matching local account.

### Link and unlink

Linking requires an authenticated session. Unlinking refuses the last remaining method — invariant
1, enforced by the aggregate rather than by the controller that happens to call it.

### Sessions

Access token: JWT, 10–15 minutes, signed, carrying `sub` and the session family. Any service
verifies it without a database round trip.

Refresh token: opaque random, **stored as a hash**, single-use, rotated on every refresh. Presenting
a token that was already used revokes the whole family — that pattern is theft detection, because
the legitimate client and the thief cannot both hold the newest token.

Sign-out revokes the family.

## Password hashing

argon2id via `@node-rs/argon2` — prebuilt binaries, so no node-gyp in the image. OWASP baseline
parameters (m=19456 KiB, t=2, p=1), stored alongside the hash so they can move.

Behind a port:

```ts
abstract class PasswordHasher {
  hash(plaintext: string): Promise<PasswordHash>;
  verify(hash: PasswordHash, plaintext: string): Promise<boolean>;
  needsRehash(hash: PasswordHash): boolean;
}
```

A port because it is infrastructure, because tests need a fast fake, and because the algorithm will
change at least once.

## What must never escape

The hash is absent from every read model and every response contract — structurally, not by
omission. It exists in exactly two places: the `password_credentials` row and the aggregate loaded
on a write path.

Redaction paths are added for `req.body.password`, `req.body.currentPassword`,
`req.body.newPassword` and the token fields **when the contracts are written, not afterwards**.
Nothing can un-log a value.

## Read models

| Model               | For                    | Notably excludes                     |
| ------------------- | ---------------------- | ------------------------------------ |
| `CurrentUser`       | `GET /users/me`        | the hash, the identity rows          |
| `AuthMethodSummary` | "your sign-in methods" | any secret; provider + linkedAt only |
| `UserListItem`      | admin listing          | everything not on the screen         |

Each is projected in SQL. None constructs an aggregate.

## API surface

| Method | Path                                  | Notes                             |
| ------ | ------------------------------------- | --------------------------------- |
| POST   | `/auth/register`                      | email + password                  |
| POST   | `/auth/sign-in`                       | one error for every failure       |
| POST   | `/auth/refresh`                       | rotates; reuse revokes the family |
| POST   | `/auth/sign-out`                      | revokes the family                |
| GET    | `/auth/providers/:provider/authorize` | redirect, sets state + PKCE       |
| GET    | `/auth/providers/:provider/callback`  | the four-branch rule above        |
| POST   | `/auth/providers/:provider/link`      | authenticated                     |
| DELETE | `/auth/methods/:id`                   | refuses the last one              |
| GET    | `/users/me`                           | read model                        |

## Errors

| Code                          | Reasons                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `INVALID_CREDENTIALS`         | `EMAIL_OR_PASSWORD` — deliberately one reason, so the response cannot narrow it |
| `USER_REGISTRATION_FAILED`    | `EMAIL_ALREADY_REGISTERED`, `EMAIL_DOMAIN_BLOCKED`                              |
| `AUTH_METHOD_CONFLICT`        | `ALREADY_LINKED`, `LINKED_TO_ANOTHER_USER`                                      |
| `AUTH_METHOD_REQUIRED`        | `LAST_METHOD` — the invariant, surfaced                                         |
| `OAUTH_LINK_REQUIRES_SIGN_IN` | `EMAIL_NOT_VERIFIED_BY_PROVIDER`                                                |
| `SESSION_INVALID`             | `EXPIRED`, `REVOKED`, `REUSED`                                                  |
| `ACCOUNT_SUSPENDED`           | `SUSPENDED`                                                                     |

Registration still tells a caller that an email is taken. That is a real enumeration leak and a
product trade-off, not an oversight: the alternative is responding identically whether or not the
address exists and resolving it by email. Decide it before this ships.

## Context integration

Once a guard authenticates a request it writes the actor into the request context:

```ts
userId: uuidField({ trust: 'never', writable: 'once', log: true });
```

`trust: 'never'` means no carrier can assert it — only code. `writable: 'once'` means it cannot be
swapped mid-request. `log: true` puts the actor on every line for that request, including the
access line and every query, at no call-site cost. This is the field the context's trust rules were
built and tested for.

## What this exercises in the v1 approach

- an aggregate whose invariant spans rows, where no row constraint could substitute
- whole-aggregate save with child-collection replacement
- optimistic locking under a genuine race (two tabs unlinking two methods at once)
- read models that must exclude a secret the write model holds
- a second concept in the same feature deliberately kept at Level 0/1 (refresh tokens)
- ports for things that are not databases (`PasswordHasher`, `OAuthProvider`, `Clock`)
- the context's `trust: 'never'` field, end to end

If the aggregate turns out anemic here — if `User` ends up as getters while the handlers hold every
rule — then the approach has failed its own test, and the honest response is to drop back to
Level 1 for this codebase.
