import { asUuid } from '@sklv-labs/core/utils';
import type { z } from 'zod';

import type { UserId } from './user-id.contract';

import type { CreateUserRequestSchema } from './create-user.contract';
import type { UserRegistrationFailedSchema } from './user-errors.contract';
import type { UserResponseSchema } from './user-response.contract';

/**
 * Examples are typed against the contracts with `satisfies`, so an example that stops matching
 * its schema is a compile error rather than documentation that quietly lies. This is the cheap
 * 80% of "executable documentation" — no registry and no CI diffing required.
 *
 * Note the request example is typed as `z.input` (what a client sends) while responses use
 * `z.infer` (what the server emits).
 */
export const createUserExamples = {
  standard: {
    summary: 'Standard registration',
    value: {
      email: 'alex@example.com',
      password: 'correct-horse-battery-staple',
    } satisfies z.input<typeof CreateUserRequestSchema>,
  },
} as const;

export const userResponseExamples = {
  created: {
    summary: 'Newly created user',
    value: {
      // A branded id needs the brand applied even in an example — the cast is the price of
      // ids that cannot be mixed up at compile time.
      id: asUuid<UserId>('01930000-0000-7000-8000-000000000000'),
      email: 'alex@example.com',
      createdAt: '2026-09-03T10:00:00.000Z',
      updatedAt: '2026-09-03T10:00:00.000Z',
    } satisfies z.infer<typeof UserResponseSchema>,
  },
} as const;

export const userErrorExamples = {
  emailTaken: {
    summary: 'Email already registered',
    value: {
      statusCode: 409,
      message: 'A user with this email already exists',
      error: 'Conflict',
      errorCode: 'USER_REGISTRATION_FAILED',
      reason: 'EMAIL_ALREADY_REGISTERED',
      details: { email: 'alex@example.com' },
    } satisfies z.infer<typeof UserRegistrationFailedSchema>,
  },
  domainBlocked: {
    summary: 'Email domain is blocked',
    value: {
      statusCode: 409,
      message: 'Registrations from this email domain are not accepted',
      error: 'Conflict',
      errorCode: 'USER_REGISTRATION_FAILED',
      reason: 'EMAIL_DOMAIN_BLOCKED',
      details: { email: 'alex@blocked.example' },
    } satisfies z.infer<typeof UserRegistrationFailedSchema>,
  },
} as const;
