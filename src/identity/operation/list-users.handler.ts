import { Injectable } from '@nestjs/common';
import type { Handler } from '@sklv-labs/nestjs-core/operation';

import type { ListUsersParams } from '../domain/ports';
import { UsersQueries } from '../domain/ports';
import type { UserListItem } from '../domain/read-models';

export type ListUsersInput = { page: number; limit: number; search?: string; sort: string };
export type ListUsersOutput = { users: UserListItem[]; total: number; page: number; limit: number };

@Injectable()
export class ListUsersHandler implements Handler<ListUsersInput, ListUsersOutput> {
  constructor(private readonly users: UsersQueries) {}

  async execute(input: ListUsersInput): Promise<ListUsersOutput> {
    const params: ListUsersParams = {
      offset: (input.page - 1) * input.limit,
      limit: input.limit,
      search: input.search,
      sort: input.sort,
    };

    const { items, total } = await this.users.list(params);

    return { users: items, total, page: input.page, limit: input.limit };
  }
}
