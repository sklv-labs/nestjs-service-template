import { endpoint, failure, httpError, params, success } from '../../../../shared/http';
import { id } from '../../../../shared/contracts';
import { UserNotFound } from '../../../domain';
import type { UserId } from '../../../domain';
import { userResponse } from '../responses';

export const getUser = endpoint({
  summary: 'Fetch a user by id',
  request: {
    params: params({ id: id<UserId>({ describe: 'Identifier of the user' }) }),
  },
  responses: [
    success(200, 'The user', userResponse),
    failure(400, 'The id is not a UUID v7'),
    httpError(404, UserNotFound, 'No user with that id'),
  ],
});
