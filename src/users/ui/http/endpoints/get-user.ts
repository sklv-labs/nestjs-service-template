import { endpoint, failure, httpError, req, success } from '../../../../shared/http';
import { id } from '../../../../shared/contracts';
import { UserNotFound } from '../../../domain';
import type { UserId } from '../../../domain';
import type { GetUserInput, GetUserOutput } from '../../../operation';
import { toUserResponse, userResponse } from '../responses';

export const getUser = endpoint({
  summary: 'Fetch a user by id',
  request: {
    params: req.params({ id: id<UserId>({ describe: 'Identifier of the user' }) }),
  },
  toInput: ({ params }): GetUserInput => ({ id: params.id }),
  toResponse: (output: GetUserOutput) => toUserResponse(output.user),
  responses: [
    success(200, 'The user', userResponse),
    failure(400, 'The id is not a UUID v7'),
    httpError(404, UserNotFound, 'No user with that id'),
  ],
});
