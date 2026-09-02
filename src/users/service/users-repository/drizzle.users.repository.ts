import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

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

  async create(user: UserInsert): Promise<UserSelect> {
    const [row] = await this.db.insert(users).values(user).returning();

    if (!row) {
      throw new Error('Insert returned no row');
    }

    return row;
  }
}
