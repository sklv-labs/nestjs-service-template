import { z } from 'zod';

import { email, str } from '../../../../shared/contracts';
import { endpoint, failure, httpError, req, success } from '../../../../shared/http';
import { UserRegistrationFailed } from '../../../domain';
import type { CreateUserInput, CreateUserOutput } from '../../../operation';
import { toUserResponse, userResponse } from '../responses';

export const createUser = endpoint({
  summary: 'Register a user',
  description:
    'Validates the body, then applies registration rules. A 409 carries a stable errorCode ' +
    'with a reason that narrows which rule refused it.',
  request: {
    headers: req.headers({
      'x-request-id': str({ describe: 'Correlation id, echoed in logs' }).optional(),
    }),
    body: req.body({
      email: email({ describe: "The user's primary email address" }),
      password: str({ min: 12, max: 256, describe: 'Plaintext password, at least 12 characters' }),
    }),
    bodyExamples: {
      standard: {
        summary: 'Standard registration',
        value: { email: 'alex@example.com', password: 'correct-horse-battery-staple' },
      },
    },
  },
  toInput: ({ body, headers }): CreateUserInput => ({
    email: body.email,
    password: body.password,
    correlationId: headers['x-request-id'],
  }),
  toResponse: (output: CreateUserOutput) => toUserResponse(output.user),
  responses: [
    success(201, 'User registered', userResponse, {
      created: {
        summary: 'Newly created user',
        value: {
          id: '01930000-0000-7000-8000-000000000000',
          email: 'alex@example.com',
          createdAt: '2026-09-03T10:00:00.000Z',
          updatedAt: '2026-09-03T10:00:00.000Z',
        } satisfies z.input<typeof userResponse>,
      },
    }),
    failure(400, 'Body failed contract validation'),
    httpError(409, UserRegistrationFailed, 'Registration refused', {
      emailTaken: {
        summary: 'Email already registered',
        value: {
          statusCode: 409,
          message: 'A user with this email already exists',
          errorCode: 'USER_REGISTRATION_FAILED',
          reason: 'EMAIL_ALREADY_REGISTERED',
          details: { email: 'alex@example.com' },
        },
      },
      domainBlocked: {
        summary: 'Email domain is blocked',
        value: {
          statusCode: 409,
          message: 'Registrations from this email domain are not accepted',
          errorCode: 'USER_REGISTRATION_FAILED',
          reason: 'EMAIL_DOMAIN_BLOCKED',
          details: { email: 'alex@blocked.example' },
        },
      },
    }),
  ],
});
