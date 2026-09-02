import { Injectable } from '@nestjs/common';

import type { Handler } from '../../shared/operation';
import type { UserRow } from '../domain';
import { UsersService } from '../service/users.service';

export type ListUsersInput = {
  page: number;
  limit: number;
  search?: string;
  sort: string;
};

export type ListUsersOutput = {
  users: UserRow[];
  page: number;
  limit: number;
  total: number;
};

/**
 * The input is paging intent, not HTTP query parameters — the offset arithmetic is the operation's
 * business, so a queue worker asking for page 3 does not have to know how to compute it.
 */
@Injectable()
export class ListUsersHandler implements Handler<ListUsersInput, ListUsersOutput> {
  constructor(private readonly users: UsersService) {}

  async execute(input: ListUsersInput): Promise<ListUsersOutput> {
    const { rows, total } = await this.users.list({
      offset: (input.page - 1) * input.limit,
      limit: input.limit,
      search: input.search,
      sort: input.sort,
    });

    return { users: rows, page: input.page, limit: input.limit, total };
  }
}
