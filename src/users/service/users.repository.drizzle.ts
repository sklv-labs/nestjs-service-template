import { Injectable } from '@nestjs/common';
import type { Database } from '@sklv-labs/nestjs-core/database';
import { InjectDatabase } from '@sklv-labs/nestjs-core/database';
import { asc, desc, eq, ilike } from 'drizzle-orm';

import type { NewUserRow, UserId, UserRow } from '../domain';
import { users } from '../domain';

import type { ListUsersParams } from './users.repository';
import { UsersRepository } from './users.repository';

/** Whitelisted so a sort value from the query string can never reach SQL as an identifier. */
const SORTABLE = { createdAt: users.createdAt, email: users.email };

@Injectable()
export class DrizzleUsersRepository extends UsersRepository {
  /**
   * Transaction-aware: inside a `@Transactional()` method this client *is* the transaction, so a
   * repository needs no transaction parameter and cannot be passed the wrong one.
   */
  @InjectDatabase() private readonly db: Database;

  async findById(id: UserId): Promise<UserRow | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);

    return row ?? null;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);

    return row ?? null;
  }

  async list(params: ListUsersParams): Promise<{ rows: UserRow[]; total: number }> {
    const where = params.search ? ilike(users.email, `%${params.search}%`) : undefined;

    const descending = params.sort.startsWith('-');
    const field = descending ? params.sort.slice(1) : params.sort;
    const column = SORTABLE[field as keyof typeof SORTABLE] ?? users.createdAt;

    // Two statements rather than a window function: `count(*) over ()` would return no total when
    // the page is empty, which is exactly when a caller needs to know there are earlier pages.
    const [rows, total] = await Promise.all([
      this.db
        .select()
        .from(users)
        .where(where)
        .orderBy(descending ? desc(column) : asc(column))
        .limit(params.limit)
        .offset(params.offset),
      this.db.$count(users, where),
    ]);

    return { rows, total };
  }

  async create(user: NewUserRow): Promise<UserRow> {
    const [row] = await this.db.insert(users).values(user).returning();

    if (!row) {
      // `returning()` on a successful single-row insert always yields a row; this is unreachable
      // except through a driver bug, and returning `undefined as UserRow` would hide it.
      throw new Error('Insert returned no row');
    }

    return row;
  }
}
