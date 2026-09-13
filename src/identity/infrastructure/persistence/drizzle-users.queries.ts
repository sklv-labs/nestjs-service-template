import { Injectable } from '@nestjs/common';
import type { Database } from '@sklv-labs/nestjs-core/database';
import { InjectDatabase } from '@sklv-labs/nestjs-core/database';
import { asc, desc, eq, ilike } from 'drizzle-orm';

import { Email } from '../../domain/value-objects/email';
import type { AuthMethodSummary, CurrentUser, UserListItem } from '../../domain/read-models';
import type { ListUsersParams } from '../../domain/ports';
import { UsersQueries } from '../../domain/ports';
import { oauthAccounts, passwordCredentials, users } from '../../domain/schemas';
import type { UserId } from '../../domain/value-objects/user-id';

/** Whitelisted, so a sort value from a query string can never reach SQL as an identifier. */
const SORTABLE = { createdAt: users.createdAt, email: users.email };

/**
 * The read side: projections, never aggregates.
 *
 * Each of these selects the columns its read model declares and nothing else — which is also why
 * no query here can leak a password hash. The column is not in the select list, so there is
 * nothing to remember to omit.
 */
@Injectable()
export class DrizzleUsersQueries extends UsersQueries {
  @InjectDatabase() private readonly db: Database;

  async list(params: ListUsersParams): Promise<{ items: UserListItem[]; total: number }> {
    const where = params.search ? ilike(users.email, `%${params.search}%`) : undefined;

    const descending = params.sort.startsWith('-');
    const field = descending ? params.sort.slice(1) : params.sort;
    const column = SORTABLE[field as keyof typeof SORTABLE] ?? users.createdAt;

    const [rows, total] = await Promise.all([
      this.db
        .select({
          id: users.id,
          email: users.email,
          status: users.status,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(where)
        .orderBy(descending ? desc(column) : asc(column))
        .limit(params.limit)
        .offset(params.offset),
      this.db.$count(users, where),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        email: Email.restore(row.email),
        status: row.status,
        createdAt: row.createdAt,
      })),
      total,
    };
  }

  async byId(id: UserId): Promise<CurrentUser | null> {
    const [row] = await this.db
      .select({
        id: users.id,
        email: users.email,
        emailVerifiedAt: users.emailVerifiedAt,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return row === undefined
      ? null
      : {
          id: row.id,
          email: Email.restore(row.email),
          emailVerified: row.emailVerifiedAt !== null,
          status: row.status,
          createdAt: row.createdAt,
        };
  }

  /**
   * Two selects and a concatenation rather than a union: the two method kinds have different
   * shapes, which is the whole reason they are different tables.
   */
  async methodsOf(id: UserId): Promise<AuthMethodSummary[]> {
    const [password, accounts] = await Promise.all([
      this.db
        .select({ updatedAt: passwordCredentials.updatedAt })
        .from(passwordCredentials)
        .where(eq(passwordCredentials.userId, id))
        .limit(1),
      this.db
        .select({
          id: oauthAccounts.id,
          provider: oauthAccounts.provider,
          email: oauthAccounts.email,
          linkedAt: oauthAccounts.linkedAt,
        })
        .from(oauthAccounts)
        .where(eq(oauthAccounts.userId, id)),
    ]);

    return [
      ...password.map((row): AuthMethodSummary => ({ kind: 'password', updatedAt: row.updatedAt })),
      ...accounts.map((row): AuthMethodSummary => ({
        kind: 'oauth',
        id: row.id,
        provider: row.provider,
        email: row.email === null ? null : Email.restore(row.email),
        linkedAt: row.linkedAt,
      })),
    ];
  }
}
