# v1 architecture — domain model and layering

Status: **provisional, under test.** This describes the approach we are trying, not a convention.
It is judged by implementing auth (see [auth-design.md](./auth-design.md)) and kept, amended or
discarded on the evidence. The criteria for that judgement are at the end.

## The decision in one paragraph

A persistence row is a tuple shaped by storage concerns. A domain entity is a consistency boundary
with invariants. They are separated **only where the divergence is real** — a module with genuine
invariants gets an aggregate, a mapper and a repository port; a CRUD module gets rows and DTOs and
nothing else. Mixing both styles in one codebase is correct. Applying the full pattern everywhere
is the failure mode we are trying to avoid.

## Levels, and how to choose one

| Level | Shape                                                 | Use when                                                                  |
| ----- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| 0     | ORM row is the model                                  | CRUD, lookup tables, settings                                             |
| 1     | Plain domain type + mapper                            | secrets or audit columns to hide; storage shape drifting from the concept |
| 2     | + value objects, always-valid construction            | invariants spanning fields                                                |
| 3     | + aggregate over several tables, snapshot persistence | invariants spanning rows or entities                                      |
| 4     | event sourcing                                        | not in scope                                                              |

Climb on a signal, not on principle. **Auth is Level 3** because "a user must always keep at least
one way to sign in" spans the user and its identity rows. Refresh tokens are **Level 0/1** in the
same feature, because they have no invariant worth an aggregate. That mixture is deliberate and is
itself part of what we are testing.

## Two paths, three type families

"Reads bypass the domain" means reads bypass the **aggregate**, not the layer. A read model is a
feature-owned type. Database rows never leave the adapter on either path.

|                    | write path                        | read path                       |
| ------------------ | --------------------------------- | ------------------------------- |
| above the adapter  | aggregate — behaviour, invariants | read model — flat, no behaviour |
| inside the adapter | row → snapshot → entity           | SQL projection → read model     |
| at the transport   | response contract (zod)           | response contract (zod)         |

### Write

```
controller → handler → repository.findById(id) → User      aggregate, reconstructed
                     → user.linkOAuth(profile)             invariant enforced here
                     → repository.save(user)               whole aggregate, one transaction
                     → toResponse(user.snapshot())
```

### Read

```
controller → handler → usersQueries.listIdentities(userId) → AuthMethodSummary[]
                     → toResponse(items)
```

No entity is constructed. The projection selects exactly the columns the read model declares, and
may join across aggregates — which is legal here and forbidden on the write path. That asymmetry is
the point: aggregates are shaped by consistency boundaries, screens are shaped by what someone is
looking at, and those two forces have no reason to agree.

## Ports

```ts
abstract class UsersRepository {
  // write side
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
}

abstract class UsersQueries {
  // read side
  listUsers(params: ListParams): Promise<{ items: UserListItem[]; total: number }>;
  currentUser(id: UserId): Promise<CurrentUser | null>;
}
```

**The repository has no `list`, no projections and no partial loads. The query port has no `save`.**
A `findByIdWithoutIdentities` makes invariants unenforceable, and is almost always a read wearing a
write's clothes.

Both are `abstract class`, so each is its own DI token without a symbol.

## Entity rules

**Generate ids in the domain.** UUIDv7, minted by `UserId.next()`. A DB-generated id means the
entity is invalid until it is saved: no object graph in memory, no events before commit, no unit
test without a database.

**`create()` validates, `restore()` does not.** Rows already in the database were valid under the
rules of the day. Re-validating on read means a rule change bricks old data.

**No `now()` inside an entity.** Time arrives as an argument or through a `Clock` port, or
time-based rules cannot be tested.

**Inside an aggregate, hold objects; across aggregates, hold ids.** `user.identities` is a real
collection. A reference to another aggregate is `accountId`, never `account`. If a rule needs the
other aggregate, the handler loads both and passes the _value_ in.

**Never lazy-load from a domain object.** The moment `user.account` issues a query, the domain
depends on an open connection.

**Persist whole aggregates.** Child collections are replaced wholesale (delete-then-insert within
the transaction) until that measurably hurts; a user has fewer than ten identities.

**Optimistic locking.** A `version` column, checked in the update predicate. `save()` must advance
the in-memory version too, or a second save in the same unit of work fails spuriously.

**Do not let the database own values the entity owns.** `defaultNow()` stays as a backstop for raw
SQL, but if the entity carries `createdAt`, the application sets it — otherwise the in-memory
object is stale the moment it is inserted.

## Where rows may be imported

Tables stay at `<feature>/domain/schemas/<name>.schema.ts` because `drizzle.config.ts` globs that
path. That location is a tooling convention, not a claim that a table is a domain concept — so the
rule is about **importers**, not about the file:

- `UserRow` / `NewUserRow` are not exported from `domain/`; the adapter derives them locally.
- Only files under the persistence adapter directory may import `drizzle-orm` or a `*.schema` file.
- Enforced with `no-restricted-imports` in oxlint, because six months of discipline is not a plan.

If we later decide a table is unambiguously infrastructure, moving it is a one-line change to the
glob.

## Layering after this change

```
ui → operation → domain
                 ↑
            adapters (persistence, providers) implement the ports
```

The `service/` layer largely dissolves. Rules that need only an aggregate's own state move onto the
entity; rules that need another aggregate or a port live in the handler, which _is_ the application
service. `UsersService` and `CreateUserHandler` are currently two names for one job.

## What this replaces

The `users` feature as it stands is Level 0 with the row type leaking: `UserRow` appears in eight
files across all four layers, the operation layer declares `GetUserOutput = { user: UserRow }`, and
`passwordHash` travels to the UI where two independent controls keep it out of responses — the
contract omits it and the serializer strips it. One type could make it unreachable instead.

## How we judge it

Decided before building, so the result is not rationalised afterwards.

| Question                       | Signal                                                                      |
| ------------------------------ | --------------------------------------------------------------------------- |
| Does it prevent real mistakes? | a password hash or an unverified link is unrepresentable, not merely absent |
| What does a field cost?        | files touched to add one field to one concept                               |
| What does a read cost?         | queries and columns fetched for a list screen                               |
| Is it testable?                | a meaningful domain test needs no database                                  |
| Is it learnable?               | what a newcomer must read before adding an endpoint                         |
| Is the entity real?            | if the aggregate is only getters, we paid mapping for nothing               |

**What would make us discard it:** the aggregate turns out anemic; mapping exceeds roughly a third
of the feature's code; or reads end up needing the write model after all.

**What would make us extend it to every feature:** the invariants caught by the type system are
ones that had previously been caught in review, or not at all.
