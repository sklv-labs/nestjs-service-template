import { oneOf, pageQuery, str } from '../../../../shared/contracts';
import { endpoint, failure, req, success } from '../../../../shared/http';
import type { ListUsersInput, ListUsersOutput } from '../../../operation';
import { toUserResponse, userListResponse } from '../responses';

export const listUsers = endpoint({
  summary: 'List users',
  request: {
    query: req.query({
      ...pageQuery,
      search: str({ min: 1, max: 100, describe: 'Case-insensitive match on email' }).optional(),
      sort: oneOf(['createdAt', '-createdAt', 'email', '-email'], {
        describe: 'Sort field, prefixed with - for descending',
      }).default('-createdAt'),
    }),
  },
  toInput: ({ query }): ListUsersInput => ({
    page: query.page,
    limit: query.limit,
    search: query.search,
    sort: query.sort,
  }),
  toResponse: (output: ListUsersOutput) => ({
    items: output.users.map(toUserResponse),
    meta: { page: output.page, limit: output.limit, total: output.total },
  }),
  responses: [
    success(200, 'A page of users', userListResponse),
    failure(400, 'Query failed contract validation'),
  ],
});
