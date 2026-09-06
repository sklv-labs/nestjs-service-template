import { endpoint, failure } from '../../../../shared/http';
import type { GetUserInput, GetUserOutput } from '../../../operation';
import { userNotFound } from '../error-responses';
import { userIdParams } from '../requests';
import { toUserResponse, userResponse } from '../responses';

export const getUser = endpoint({
  summary: 'Fetch a user by id',

  request: { params: userIdParams },

  toInput: ({ params }): GetUserInput => ({ id: params.id }),
  toResponse: (out: GetUserOutput) => toUserResponse(out.user),

  success: { status: 200, schema: userResponse, description: 'The user' },
  errors: [failure(400, 'The id is not a UUID v7'), userNotFound],
});
