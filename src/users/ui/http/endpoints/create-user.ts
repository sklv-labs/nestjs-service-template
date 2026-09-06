import { email, str } from '../../../../shared/contracts';
import { endpoint, failure, req } from '../../../../shared/http';
import type { CreateUserInput, CreateUserOutput } from '../../../operation';
import { userRegistrationFailed } from '../error-responses';
import { toUserResponse, userResponse } from '../responses';

export const createUser = endpoint({
  summary: 'Register a user',
  description: 'Validates the body, then applies registration rules.',

  request: {
    headers: req.headers({
      'x-request-id': str('Correlation id (UUID). Generated when absent or not a UUID.', {
        example: '3f8a1c2e-5b7d-4e9f-9a1b-2c3d4e5f6a7b',
      }).optional(),
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

  success: { status: 201, schema: userResponse, description: 'User registered' },
  errors: [failure(400, 'Body failed contract validation'), userRegistrationFailed],
});
