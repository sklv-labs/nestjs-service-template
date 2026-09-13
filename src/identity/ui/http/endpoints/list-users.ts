import { int, oneOf, str } from '@sklv-labs/nestjs-core/contracts';
import { endpoint, failure, req } from '@sklv-labs/nestjs-core/http';

import type { ListUsersInput, ListUsersOutput } from '../../../operation';
import { toUserListItemResponse, userListResponse } from '../responses';

const querySchema = req.query({
  page: int('Page number, one-based', { min: 1, example: 1 }).default(1),
  limit: int('Rows per page', { min: 1, max: 100, example: 20 }).default(20),
  search: str('Filter by email substring', { example: 'alex' }).optional(),
  sort: oneOf(
    ['createdAt', '-createdAt', 'email', '-email'],
    'Sort field, prefixed with - for descending',
  ).default('-createdAt'),
});

export const listUsers = endpoint({
  summary: 'List users',

  request: { query: querySchema },

  toInput: ({ query }): ListUsersInput => ({
    page: query.page,
    limit: query.limit,
    search: query.search,
    sort: query.sort,
  }),
  toResponse: (out: ListUsersOutput) => ({
    items: out.users.map(toUserListItemResponse),
    meta: { page: out.page, limit: out.limit, total: out.total },
  }),

  success: { status: 200, schema: userListResponse, description: 'A page of users' },
  errors: [failure(400, 'Query failed contract validation')],
});
