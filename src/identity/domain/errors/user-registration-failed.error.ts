import { email } from '@sklv-labs/nestjs-core/contracts';
import { businessError } from '@sklv-labs/nestjs-core/errors';
import { z } from 'zod';

/**
 * Registration was refused. One code, several reasons: a new way to fail adds a reason, while a
 * second code would break every client branching on this one.
 *
 * `EMAIL_ALREADY_REGISTERED` tells a caller that an address is taken, which is an enumeration
 * leak accepted deliberately — see docs/auth-design.md.
 */
export const UserRegistrationFailed = businessError({
  code: 'USER_REGISTRATION_FAILED',
  details: z.object({ email: email() }),
  reasons: {
    EMAIL_ALREADY_REGISTERED: 'A user with this email already exists',
    EMAIL_DOMAIN_BLOCKED: 'Registrations from this email domain are not accepted',
  },
});
