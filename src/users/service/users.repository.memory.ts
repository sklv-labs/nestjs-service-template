import { Injectable } from '@nestjs/common';
import { uuid } from '@sklv-labs/core/utils';

import type { NewUserRow, UserId, UserRow } from '../domain';

import type { ListUsersParams } from './users.repository';
import { UsersRepository } from './users.repository';

/** The bound adapter, so the feature runs with no database. */
@Injectable()
export class InMemoryUsersRepository extends UsersRepository {
  private readonly rows = new Map<string, UserRow>();

  findById(id: UserId): Promise<UserRow | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  findByEmail(email: string): Promise<UserRow | null> {
    return Promise.resolve([...this.rows.values()].find((row) => row.email === email) ?? null);
  }

  list(params: ListUsersParams): Promise<{ rows: UserRow[]; total: number }> {
    let rows = [...this.rows.values()];

    if (params.search) {
      const needle = params.search.toLowerCase();
      rows = rows.filter((row) => row.email.toLowerCase().includes(needle));
    }

    const descending = params.sort.startsWith('-');
    const field = descending ? params.sort.slice(1) : params.sort;

    rows.sort((a, b) => {
      const left = field === 'email' ? a.email : a.createdAt.getTime();
      const right = field === 'email' ? b.email : b.createdAt.getTime();
      const order = left < right ? -1 : left > right ? 1 : 0;
      return descending ? -order : order;
    });

    return Promise.resolve({
      rows: rows.slice(params.offset, params.offset + params.limit),
      total: rows.length,
    });
  }

  create(user: NewUserRow): Promise<UserRow> {
    const now = new Date();
    const row: UserRow = {
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
