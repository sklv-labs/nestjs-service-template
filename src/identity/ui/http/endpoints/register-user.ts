import { email, str } from '@sklv-labs/nestjs-core/contracts';
import { endpoint, failure, req } from '@sklv-labs/nestjs-core/http';

import type { RegisterUserInput, RegisterUserOutput } from '../../../operation';
import { invalidEmail, userRegistrationFailed } from '../error-responses';
import { toUserResponse, userResponse } from '../responses';

const bodySchema = req.body({
  email: email("The user's primary email address", { example: 'alex@example.com' }),
  password: str('Plaintext password, at least 12 characters', {
    min: 12,
    max: 256,
    example: 'correct-horse-battery-staple',
  }),
});

export const registerUser = endpoint({
  summary: 'Register with an email and password',
  description: 'Creates an account and attaches a password as its first sign-in method.',

  request: { body: bodySchema },

  toInput: ({ body }): RegisterUserInput => ({ email: body.email, password: body.password }),
  toResponse: (out: RegisterUserOutput) => toUserResponse(out.user),

  success: { status: 201, schema: userResponse, description: 'Account created' },
  errors: [failure(400, 'Body failed contract validation'), invalidEmail, userRegistrationFailed],
});
