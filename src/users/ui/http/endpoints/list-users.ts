import { endpoint, failure } from '../../../../shared/http';
import type { ListUsersInput, ListUsersOutput } from '../../../operation';
import { listUsersQuery } from '../requests';
import { toUserResponse, userListResponse } from '../responses';

export const listUsers = endpoint({
  summary: 'List users',

  request: { query: listUsersQuery },

  toInput: ({ query }): ListUsersInput => ({
    page: query.page,
    limit: query.limit,
    search: query.search,
    sort: query.sort,
  }),
  toResponse: (out: ListUsersOutput) => ({
    items: out.users.map(toUserResponse),
    meta: { page: out.page, limit: out.limit, total: out.total },
  }),

  success: { status: 200, schema: userListResponse, description: 'A page of users' },
  errors: [failure(400, 'Query failed contract validation')],
});
