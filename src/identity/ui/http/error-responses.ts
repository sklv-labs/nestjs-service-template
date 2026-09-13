import { httpError } from '@sklv-labs/nestjs-core/http';

import { InvalidEmail, UserNotFound, UserRegistrationFailed } from '../../domain/errors';

/**
 * Error responses shared across endpoints. `httpError` both documents the response and registers
 * the code-to-status mapping the filter uses, so the two cannot drift.
 */
export const userRegistrationFailed = httpError(409, UserRegistrationFailed, {
  email: 'alex@example.com',
});

export const userNotFound = httpError(404, UserNotFound, {
  id: '01930000-0000-7000-8000-000000000000',
});

export const invalidEmail = httpError(400, InvalidEmail, { email: 'not-an-address' });

// AuthMethodRequired and ConcurrentModification are declared in the domain but not documented
// here yet: nothing raises them over HTTP until link and unlink exist. The boot scan names them,
// which is the warning working rather than a gap to paper over.
