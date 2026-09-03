import { id } from '../../../../shared/contracts';
import { endpoint, failure, httpError, req, success } from '../../../../shared/http';
import type { UserId } from '../../../domain';
import { UserNotFound } from '../../../domain';
import type { GetUserInput, GetUserOutput } from '../../../operation';
import { toUserResponse, userResponse } from '../responses';

export const getUser = endpoint({
  summary: 'Fetch a user by id',

  request: {
    params: req.params({ id: id<UserId>('Identifier of the user') }),
  },

  toInput: ({ params }): GetUserInput => ({ id: params.id }),
  toResponse: (out: GetUserOutput) => toUserResponse(out.user),

  responses: [
    success(200, userResponse, 'The user'),
    failure(400, 'The id is not a UUID v7'),
    httpError(
      404,
      UserNotFound,
      { id: '01930000-0000-7000-8000-000000000000' },
      'No user with that id',
    ),
  ],
});
