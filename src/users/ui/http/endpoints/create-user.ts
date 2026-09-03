import { email, str } from '../../../../shared/contracts';
import { endpoint, failure, httpError, req, success } from '../../../../shared/http';
import { UserRegistrationFailed } from '../../../domain';
import type { CreateUserInput, CreateUserOutput } from '../../../operation';
import { toUserResponse, userResponse } from '../responses';

export const createUser = endpoint({
  summary: 'Register a user',
  description: 'Validates the body, then applies registration rules.',

  request: {
    headers: req.headers({
      'x-request-id': str('Correlation id, echoed in logs', { example: 'req-7f3a91' }).optional(),
    }),
    body: req.body({
      email: email("The user's primary email address", { example: 'alex@example.com' }),
      password: str('Plaintext password, at least 12 characters', {
        min: 12,
        max: 256,
        example: 'correct-horse-battery-staple',
      }),
    }),
  },

  toInput: ({ body, headers }): CreateUserInput => ({
    email: body.email,
    password: body.password,
    correlationId: headers['x-request-id'],
  }),
  toResponse: (out: CreateUserOutput) => toUserResponse(out.user),

  responses: [
    success(201, userResponse, 'User registered'),
    failure(400, 'Body failed contract validation'),
    httpError(409, UserRegistrationFailed, { email: 'alex@example.com' }, 'Registration refused'),
  ],
});
