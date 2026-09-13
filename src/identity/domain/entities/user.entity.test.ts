import { describe, expect, it } from 'vitest';

import { Email } from '../value-objects/email';
import { UserId } from '../value-objects/user-id';

import { User } from './user.entity';
import type { ProviderProfile } from './user.types';

const NOW = new Date('2026-09-13T10:00:00.000Z');
const LATER = new Date('2026-09-13T11:00:00.000Z');

const google = (overrides: Partial<ProviderProfile> = {}): ProviderProfile => ({
  provider: 'google',
  externalId: '108123456789',
  email: Email.of('alex@example.com'),
  emailVerified: true,
  displayName: 'Alex',
  ...overrides,
});

const registered = () =>
  User.register({ id: UserId.next(), email: Email.of('alex@example.com'), now: NOW });

const withPassword = () => {
  const user = registered();
  user.setPassword('$argon2id$hash', NOW);

  return user;
};

describe('registering', () => {
  it('starts active, unverified and with no way to sign in', () => {
    const user = registered();

    expect(user.status).toBe('active');
    expect(user.emailVerifiedAt).toBeNull();
    // `register` cannot attach a method: hashing is a port, so the caller does it.
    expect(user.methodCount).toBe(0);
  });

  it('normalises the address before it is ever compared or indexed', () => {
    const user = User.register({
      id: UserId.next(),
      email: Email.of('  Alex@Example.COM '),
      now: NOW,
    });

    expect(user.email).toBe('alex@example.com');
  });
});

describe('the last sign-in method', () => {
  it('cannot be removed, because that would lock the account permanently', () => {
    const user = withPassword();

    expect(() => user.unlink({ kind: 'password' }, LATER)).toThrow(
      /only way to sign in and cannot be removed/,
    );
    expect(user.methodCount).toBe(1);
  });

  it('can be removed once a second one exists', () => {
    const user = withPassword();
    user.linkOAuth(google(), LATER);

    user.unlink({ kind: 'password' }, LATER);

    expect(user.passwordHash).toBeNull();
    expect(user.methodCount).toBe(1);
  });

  it('refuses the last one whichever kind it is', () => {
    const user = registered();
    const id = user.linkOAuth(google(), NOW);

    expect(() => user.unlink({ kind: 'oauth', id }, LATER)).toThrow(/cannot be removed/);
  });
});

describe('linking a provider', () => {
  it('refuses a second account from the same provider', () => {
    const user = withPassword();
    user.linkOAuth(google(), NOW);

    expect(() => user.linkOAuth(google({ externalId: 'other' }), LATER)).toThrow(/already linked/);
  });

  it('verifies the address when the provider vouches for the same one', () => {
    const user = withPassword();

    user.linkOAuth(google({ emailVerified: true }), LATER);

    expect(user.emailVerifiedAt).toEqual(LATER);
  });

  it('does not verify when the provider does not vouch', () => {
    const user = withPassword();

    user.linkOAuth(google({ emailVerified: false }), LATER);

    expect(user.emailVerifiedAt).toBeNull();
  });

  it('does not verify when the provider vouches for a different address', () => {
    const user = withPassword();

    user.linkOAuth(google({ email: Email.of('someone.else@example.com') }), LATER);

    expect(user.emailVerifiedAt).toBeNull();
  });
});

describe('unlinking something that is not there', () => {
  it('reports the method rather than silently succeeding', () => {
    const user = withPassword();
    user.linkOAuth(google(), NOW);

    expect(() => user.unlink({ kind: 'oauth', id: UserId.next() as never }, LATER)).toThrow(
      /No such sign-in method/,
    );
  });
});

describe('snapshots', () => {
  it('round-trip through restore without re-running create-time rules', () => {
    const user = withPassword();
    user.linkOAuth(google(), LATER);

    const restored = User.restore(user.snapshot());

    expect(restored.snapshot()).toEqual(user.snapshot());
  });

  it('do not alias the aggregate: mutating the copy cannot change the original', () => {
    const user = withPassword();
    user.linkOAuth(google(), LATER);

    const snapshot = user.snapshot();
    snapshot.oauthAccounts.pop();

    expect(user.methodCount).toBe(2);
  });
});

describe('versioning', () => {
  it('starts at zero and is advanced by the repository, not by mutation', () => {
    const user = withPassword();

    expect(user.version).toBe(0);

    // Without this the next save matches no row and reports a conflict that never happened.
    user.committed(1);

    expect(user.version).toBe(1);
  });
});
