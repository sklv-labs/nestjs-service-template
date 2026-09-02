import { oneOf, pageQuery, str } from '../../../../shared/contracts';
import { endpoint, failure, query, success } from '../../../../shared/http';
import { userListResponse } from '../responses';

export const listUsers = endpoint({
  summary: 'List users',
  request: {
    query: query({
      ...pageQuery,
      search: str({ min: 1, max: 100, describe: 'Case-insensitive match on email' }).optional(),
      sort: oneOf(['createdAt', '-createdAt', 'email', '-email'], {
        describe: 'Sort field, prefixed with - for descending',
      }).default('-createdAt'),
    }),
  },
  responses: [
    success(200, 'A page of users', userListResponse),
    failure(400, 'Query failed contract validation'),
  ],
});
