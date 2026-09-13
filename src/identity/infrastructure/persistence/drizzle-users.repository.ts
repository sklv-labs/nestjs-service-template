import { Injectable } from '@nestjs/common';
import type { Database } from '@sklv-labs/nestjs-core/database';
import { InjectDatabase } from '@sklv-labs/nestjs-core/database';
import type { SQL } from 'drizzle-orm';
import { eq } from 'drizzle-orm';

import type { User } from '../../domain/entities';
import { ConcurrentModification } from '../../domain/errors';
import { UsersRepository } from '../../domain/ports';
import { oauthAccounts, passwordCredentials, users } from '../../domain/schemas';
import type { Email } from '../../domain/value-objects/email';
import type { UserId } from '../../domain/value-objects/user-id';

import { UserMapper } from './user.mapper';

@Injectable()
export class DrizzleUsersRepository extends UsersRepository {
  /**
   * Transaction-aware. Inside a `@Transactional()` method this client *is* the transaction, which
   * is what makes a multi-statement aggregate save atomic without threading a handle through the
   * layers. `@InjectDatabaseClient()` here would commit each statement on its own connection.
   */
  @InjectDatabase() private readonly db: Database;

  findById(id: UserId): Promise<User | null> {
    return this.load(eq(users.id, id));
  }

  findByEmail(email: Email): Promise<User | null> {
    return this.load(eq(users.email, email));
  }

  /**
   * Writes the whole aggregate.
   *
   * Child collections are replaced wholesale rather than diffed: a user has fewer than ten
   * sign-in methods, and a delete-then-insert inside the transaction is both simpler and immune to
   * the class of bug where a diff misses a field.
   */
  async save(user: User): Promise<void> {
    const snapshot = user.snapshot();
    const next = snapshot.version + 1;
    const row = UserMapper.toRow(snapshot, next);

    // Insert-or-update in one statement, with the version in the predicate. A row that exists at a
    // different version matches nothing, and the empty result is the conflict.
    const written = await this.db
      .insert(users)
      .values(row)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: row.email,
          emailVerifiedAt: row.emailVerifiedAt,
          status: row.status,
          version: next,
          updatedAt: row.updatedAt,
        },
        where: eq(users.version, snapshot.version),
      })
      .returning({ id: users.id });

    if (written.length === 0) {
      throw ConcurrentModification.raise('STALE_VERSION', { id: snapshot.id });
    }

    if (snapshot.password === null) {
      await this.db.delete(passwordCredentials).where(eq(passwordCredentials.userId, snapshot.id));
    } else {
      await this.db
        .insert(passwordCredentials)
        .values({
          userId: snapshot.id,
          hash: snapshot.password.hash,
          updatedAt: snapshot.password.updatedAt,
        })
        .onConflictDoUpdate({
          target: passwordCredentials.userId,
          set: { hash: snapshot.password.hash, updatedAt: snapshot.password.updatedAt },
        });
    }

    await this.db.delete(oauthAccounts).where(eq(oauthAccounts.userId, snapshot.id));

    const accounts = UserMapper.toOAuthRows(snapshot);

    if (accounts.length > 0) {
      await this.db.insert(oauthAccounts).values(accounts);
    }

    // The in-memory object would otherwise be a version behind, and the next save in the same unit
    // of work would report a conflict that never happened.
    user.committed(next);
  }

  /**
   * Three statements rather than a join: a join would repeat the user's columns once per method
   * row and need de-duplicating in the mapper, for an aggregate that holds a handful of children.
   */
  private async load(where: SQL): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(where).limit(1);

    if (row === undefined) {
      return null;
    }

    const [password] = await this.db
      .select()
      .from(passwordCredentials)
      .where(eq(passwordCredentials.userId, row.id))
      .limit(1);

    const accounts = await this.db
      .select()
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, row.id));

    return UserMapper.toDomain(row, password ?? null, accounts);
  }
}
