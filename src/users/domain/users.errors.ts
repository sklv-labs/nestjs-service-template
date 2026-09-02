import { z } from 'zod';

import { email } from '../../shared/contracts';
import { businessError } from '../../shared/errors';

/**
 * Business errors the users domain can raise. No HTTP here — which status each maps to is
 * declared by the endpoints that document it, in `ui/http`.
 */

export const UserRegistrationFailed = businessError({
  code: 'USER_REGISTRATION_FAILED',
  reasons: ['EMAIL_ALREADY_REGISTERED', 'EMAIL_DOMAIN_BLOCKED'],
  details: z.object({ email: email() }),
});

export const UserNotFound = businessError({
  code: 'USER_NOT_FOUND',
  reasons: ['BY_ID'],
  details: z.object({ id: z.string() }),
});
