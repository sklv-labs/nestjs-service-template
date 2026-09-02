import { int, oneOf, str } from '../../../../shared/contracts';
import { endpoint } from '../../../../shared/http';
import type { ListUsersInput, ListUsersOutput } from '../../../operation';
import { toUserResponse, userListResponse } from '../responses';

export const listUsers = endpoint('List users')
  .query({
    page: int('1-based page number', { min: 1 }).default(1),
    limit: int('Items per page, max 100', { min: 1, max: 100 }).default(20),
    search: str('Case-insensitive match on email', { min: 1, max: 100 }).optional(),
    sort: oneOf(
      ['createdAt', '-createdAt', 'email', '-email'],
      'Sort field, prefixed with - for descending',
    ).default('-createdAt'),
  })
  .input(({ query }): ListUsersInput => ({
    page: query.page,
    limit: query.limit,
    search: query.search,
    sort: query.sort,
  }))
  .output((out: ListUsersOutput) => ({
    items: out.users.map(toUserResponse),
    meta: { page: out.page, limit: out.limit, total: out.total },
  }))
  .ok(200, userListResponse, 'A page of users')
  .fails(400, 'Query failed contract validation');
