import { id } from '../../../../shared/contracts';
import { endpoint, failure, req } from '../../../../shared/http';
import type { UserId } from '../../../domain';
import type { GetUserInput, GetUserOutput } from '../../../operation';
import { userNotFound } from '../error-responses';
import { toUserResponse, userResponse } from '../responses';

const paramsSchema = req.params({
  id: id<UserId>('Identifier of the user', { example: '01930000-0000-7000-8000-000000000000' }),
});

export const getUser = endpoint({
  summary: 'Fetch a user by id',

  request: { params: paramsSchema },

  toInput: ({ params }): GetUserInput => ({ id: params.id }),
  toResponse: (out: GetUserOutput) => toUserResponse(out.user),

  success: { status: 200, schema: userResponse, description: 'The user' },
  errors: [failure(400, 'The id is not a UUID v7'), userNotFound],
});
