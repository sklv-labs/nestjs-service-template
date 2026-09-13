import { AuthMethodConflict, AuthMethodNotFound, AuthMethodRequired } from '../errors';
import type { Email } from '../value-objects/email';
import type { OAuthAccountId, UserId } from '../value-objects/user-id';
import { OAuthAccountId as OAuthAccountIdFactory } from '../value-objects/user-id';

import type {
  MethodRef,
  OAuthAccountSnapshot,
  PasswordCredentialSnapshot,
  ProviderProfile,
  UserSnapshot,
  UserStatus,
} from './user.types';

/**
 * A person's account, and every way they can prove they own it.
 *
 * The sign-in methods are inside the aggregate rather than alongside it because of one rule that
 * spans them: an active user must always keep at least one. No row constraint can express "how
 * many rows remain", and getting it wrong locks someone out of their account permanently — so the
 * rule lives at the root, and the only way to add or remove a method is through it.
 *
 * Nothing here knows about HTTP, Nest or Drizzle, and nothing reads the clock: `now` is passed in,
 * or time-based rules cannot be tested.
 */
export class User {
  private constructor(
    readonly id: UserId,
    private _email: Email,
    private _emailVerifiedAt: Date | null,
    private _status: UserStatus,
    private _password: PasswordCredentialSnapshot | null,
    private _oauthAccounts: OAuthAccountSnapshot[],
    readonly createdAt: Date,
    private _updatedAt: Date,
    private _version: number,
  ) {}

  /**
   * A new account. Validates, applies business defaults, and starts with no way to sign in — the
   * caller must attach one before saving, which `register` cannot do for it because hashing is a
   * port.
   */
  static register(props: { id: UserId; email: Email; now: Date }): User {
    return new User(props.id, props.email, null, 'active', null, [], props.now, props.now, 0);
  }

  /**
   * Rehydration from storage. Deliberately does not re-run `register`'s rules: rows already
   * written were valid under the rules of the day, and re-validating on read means a rule change
   * bricks old accounts.
   */
  static restore(snapshot: UserSnapshot): User {
    return new User(
      snapshot.id,
      snapshot.email,
      snapshot.emailVerifiedAt,
      snapshot.status,
      snapshot.password,
      [...snapshot.oauthAccounts],
      snapshot.createdAt,
      snapshot.updatedAt,
      snapshot.version,
    );
  }

  get email(): Email {
    return this._email;
  }

  get status(): UserStatus {
    return this._status;
  }

  get emailVerifiedAt(): Date | null {
    return this._emailVerifiedAt;
  }

  get version(): number {
    return this._version;
  }

  /** The stored hash, for the one caller that verifies it. Never leaves a write path. */
  get passwordHash(): string | null {
    return this._password?.hash ?? null;
  }

  /** How many ways this account can be signed into. */
  get methodCount(): number {
    return (this._password === null ? 0 : 1) + this._oauthAccounts.length;
  }

  hasOAuthAccount(provider: string): boolean {
    return this._oauthAccounts.some((account) => account.provider === provider);
  }

  /** Sets or replaces the password. Replacing is a password change, not a second method. */
  setPassword(hash: string, now: Date): void {
    this._password = { hash, updatedAt: now };
    this.touch(now);
  }

  /**
   * Attaches a provider account.
   *
   * One account per provider: a second Google account on the same user has no meaning a caller
   * could act on, and makes "unlink Google" ambiguous.
   */
  linkOAuth(profile: ProviderProfile, now: Date): OAuthAccountId {
    if (this.hasOAuthAccount(profile.provider)) {
      throw AuthMethodConflict.raise('ALREADY_LINKED', { provider: profile.provider });
    }

    const id = OAuthAccountIdFactory.next();

    this._oauthAccounts = [
      ...this._oauthAccounts,
      {
        id,
        provider: profile.provider,
        providerAccountId: profile.externalId,
        email: profile.email,
        linkedAt: now,
      },
    ];

    // A provider that vouches for the address verifies it; one that does not, does not.
    if (profile.emailVerified && this._emailVerifiedAt === null && profile.email === this._email) {
      this._emailVerifiedAt = now;
    }

    this.touch(now);

    return id;
  }

  /** Detaches a sign-in method, unless it is the last one. */
  unlink(ref: MethodRef, now: Date): void {
    if (this.methodCount <= 1) {
      throw AuthMethodRequired.raise('LAST_METHOD', { userId: this.id });
    }

    if (ref.kind === 'password') {
      if (this._password === null) {
        throw AuthMethodNotFound.raise('NOT_LINKED', { method: 'password' });
      }

      this._password = null;
      this.touch(now);

      return;
    }

    const remaining = this._oauthAccounts.filter((account) => account.id !== ref.id);

    if (remaining.length === this._oauthAccounts.length) {
      throw AuthMethodNotFound.raise('NOT_LINKED', { method: ref.id });
    }

    this._oauthAccounts = remaining;
    this.touch(now);
  }

  verifyEmail(now: Date): void {
    if (this._emailVerifiedAt !== null) {
      return;
    }

    this._emailVerifiedAt = now;
    this.touch(now);
  }

  suspend(now: Date): void {
    this._status = 'suspended';
    this.touch(now);
  }

  /** The only way data leaves the aggregate, so no getter has to be added per persisted field. */
  snapshot(): UserSnapshot {
    return {
      id: this.id,
      email: this._email,
      emailVerifiedAt: this._emailVerifiedAt,
      status: this._status,
      password: this._password,
      oauthAccounts: [...this._oauthAccounts],
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
      version: this._version,
    };
  }

  /**
   * Called by the repository after a successful write, so the in-memory object is not left a
   * version behind. Without it a second save in the same unit of work matches no row and reports a
   * conflict that never happened.
   */
  committed(version: number): void {
    this._version = version;
  }

  private touch(now: Date): void {
    this._updatedAt = now;
  }
}
