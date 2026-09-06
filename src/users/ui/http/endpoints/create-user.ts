import { email, str } from '../../../../shared/contracts';
import { correlationHeaders, endpoint, failure, req } from '../../../../shared/http';
import type { CreateUserInput, CreateUserOutput } from '../../../operation';
import { userRegistrationFailed } from '../error-responses';
import { toUserResponse, userResponse } from '../responses';

// Endpoint-local: a request shape belongs to exactly one endpoint, so it lives beside it and is
// not exported. Naming avoids `body`/`params`/`query`, which would shadow what `toInput` destructures.
const bodySchema = req.body({
  email: email("The user's primary email address", { example: 'alex@example.com' }),
  password: str('Plaintext password, at least 12 characters', {
    min: 12,
    max: 256,
    example: 'correct-horse-battery-staple',
  }),
});

export const createUser = endpoint({
  summary: 'Register a user',
  description: 'Validates the body, then applies registration rules.',

  request: { headers: correlationHeaders, body: bodySchema },

  toInput: ({ body, headers }): CreateUserInput => ({
    email: body.email,
    password: body.password,
    correlationId: headers['x-request-id'],
  }),
  toResponse: (out: CreateUserOutput) => toUserResponse(out.user),

  success: { status: 201, schema: userResponse, description: 'User registered' },
  errors: [failure(400, 'Body failed contract validation'), userRegistrationFailed],
});
