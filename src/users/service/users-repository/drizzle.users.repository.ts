import { Inject, Injectable } from '@nestjs/common';
import { asc, count, desc, eq, ilike } from 'drizzle-orm';

import { type Database, DRIZZLE } from '../../../db';
import { type UserId, type UserInsert, users, type UserSelect } from '../../domain/schemas';
import { UsersRepository } from '../abstracts';

@Injectable()
export class DrizzleUsersRepository extends UsersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    super();
  }

  async findById(id: UserId): Promise<UserSelect | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  async findByEmail(email: string): Promise<UserSelect | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return row ?? null;
  }

  async list(params: {
    offset: number;
    limit: number;
    search?: string;
    sort: string;
  }): Promise<{ rows: UserSelect[]; total: number }> {
    const where = params.search ? ilike(users.email, `%${params.search}%`) : undefined;
    const descending = params.sort.startsWith('-');
    const field = descending ? params.sort.slice(1) : params.sort;
    const column = field === 'email' ? users.email : users.createdAt;

    const rows = await this.db
      .select()
      .from(users)
      .where(where)
      .orderBy(descending ? desc(column) : asc(column))
      .offset(params.offset)
      .limit(params.limit);

    const [totals] = await this.db.select({ value: count() }).from(users).where(where);

    return { rows, total: totals?.value ?? 0 };
  }

  async create(user: UserInsert): Promise<UserSelect> {
    const [row] = await this.db.insert(users).values(user).returning();

    if (!row) {
      throw new Error('Insert returned no row');
    }

    return row;
  }
}
