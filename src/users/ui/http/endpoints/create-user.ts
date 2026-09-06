import { correlationHeaders, endpoint, failure } from '../../../../shared/http';
import type { CreateUserInput, CreateUserOutput } from '../../../operation';
import { userRegistrationFailed } from '../error-responses';
import { createUserBody } from '../requests';
import { toUserResponse, userResponse } from '../responses';

export const createUser = endpoint({
  summary: 'Register a user',
  description: 'Validates the body, then applies registration rules.',

  request: { headers: correlationHeaders, body: createUserBody },

  toInput: ({ body, headers }): CreateUserInput => ({
    email: body.email,
    password: body.password,
    correlationId: headers['x-request-id'],
  }),
  toResponse: (out: CreateUserOutput) => toUserResponse(out.user),

  success: { status: 201, schema: userResponse, description: 'User registered' },
  errors: [failure(400, 'Body failed contract validation'), userRegistrationFailed],
});
