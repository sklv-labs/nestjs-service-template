import { Email } from '../../domain/value-objects/email';
import type { OAuthAccountSnapshot, UserSnapshot } from '../../domain/entities';
import { User } from '../../domain/entities';
import type { oauthAccounts, passwordCredentials, users } from '../../domain/schemas';

type UserRow = typeof users.$inferSelect;
type PasswordRow = typeof passwordCredentials.$inferSelect;
type OAuthRow = typeof oauthAccounts.$inferSelect;

/**
 * Rows to aggregate and back. The only place either shape knows about the other, and the only file
 * outside this directory that may see a row type at all.
 *
 * `Email.restore` rather than `Email.of`: these values were normalised on the way in, and
 * re-validating on read would mean a change to the address rules bricks old accounts.
 */
export const UserMapper = {
  toDomain(row: UserRow, password: PasswordRow | null, accounts: OAuthRow[]): User {
    return User.restore({
      id: row.id,
      email: Email.restore(row.email),
      emailVerifiedAt: row.emailVerifiedAt,
      status: row.status,
      password: password === null ? null : { hash: password.hash, updatedAt: password.updatedAt },
      oauthAccounts: accounts.map((account): OAuthAccountSnapshot => ({
        id: account.id,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        email: account.email === null ? null : Email.restore(account.email),
        linkedAt: account.linkedAt,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
    });
  },

  toRow(snapshot: UserSnapshot, version: number): typeof users.$inferInsert {
    return {
      id: snapshot.id,
      email: snapshot.email,
      emailVerifiedAt: snapshot.emailVerifiedAt,
      status: snapshot.status,
      version,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    };
  },

  toOAuthRows(snapshot: UserSnapshot): (typeof oauthAccounts.$inferInsert)[] {
    return snapshot.oauthAccounts.map((account) => ({
      id: account.id,
      userId: snapshot.id,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      email: account.email,
      linkedAt: account.linkedAt,
    }));
  },
};
