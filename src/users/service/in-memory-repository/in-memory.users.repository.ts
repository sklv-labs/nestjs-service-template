import { Injectable } from '@nestjs/common';
import { uuid } from '@sklv-labs/core/utils';

import type { UserId } from '../../contracts';
import type { UserInsert, UserSelect } from '../../domain/schemas';
import { UsersRepository } from '../abstracts';

/**
 * A mocked adapter so the schema-contract design can be exercised without Postgres.
 *
 * The drizzle adapter next to this one implements the same port; swapping them is the single
 * `useClass` line in `service.module.ts`. That is the point of the port existing.
 */
@Injectable()
export class InMemoryUsersRepository extends UsersRepository {
  private readonly rows = new Map<string, UserSelect>();

  findById(id: UserId): Promise<UserSelect | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  findByEmail(email: string): Promise<UserSelect | null> {
    const match = [...this.rows.values()].find((row) => row.email === email);
    return Promise.resolve(match ?? null);
  }

  list(params: {
    offset: number;
    limit: number;
    search?: string;
    sort: string;
  }): Promise<{ rows: UserSelect[]; total: number }> {
    const { offset, limit, search, sort } = params;

    let rows = [...this.rows.values()];

    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter((row) => row.email.toLowerCase().includes(needle));
    }

    const descending = sort.startsWith('-');
    const field = descending ? sort.slice(1) : sort;

    rows.sort((a, b) => {
      const left = field === 'email' ? a.email : a.createdAt.getTime();
      const right = field === 'email' ? b.email : b.createdAt.getTime();
      const order = left < right ? -1 : left > right ? 1 : 0;
      return descending ? -order : order;
    });

    return Promise.resolve({ rows: rows.slice(offset, offset + limit), total: rows.length });
  }

  create(user: UserInsert): Promise<UserSelect> {
    const now = new Date();
    const row: UserSelect = {
      id: user.id ?? uuid<UserId>(),
      email: user.email,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt ?? now,
      updatedAt: user.updatedAt ?? now,
    };

    this.rows.set(row.id, row);

    return Promise.resolve(row);
  }
}
