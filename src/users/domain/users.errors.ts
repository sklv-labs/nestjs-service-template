import { z } from 'zod';

import { email } from '../../shared/contracts';
import { businessError } from '../../shared/errors';

/**
 * Business errors the users domain can raise. No HTTP here — which status each maps to is
 * declared by the endpoints that document it, in `ui/http`.
 */

export const UserRegistrationFailed = businessError({
  code: 'USER_REGISTRATION_FAILED',
  details: z.object({ email: email() }),
  reasons: {
    EMAIL_ALREADY_REGISTERED: 'A user with this email already exists',
    EMAIL_DOMAIN_BLOCKED: 'Registrations from this email domain are not accepted',
  },
});

export const UserNotFound = businessError({
  code: 'USER_NOT_FOUND',
  details: z.object({ id: z.string() }),
  reasons: {
    BY_ID: 'No user exists with that id',
  },
});
