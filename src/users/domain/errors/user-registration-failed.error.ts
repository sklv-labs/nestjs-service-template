import { email } from '@sklv-labs/nestjs-core/contracts';
import { businessError } from '@sklv-labs/nestjs-core/errors';
import { z } from 'zod';

/**
 * Registration was refused.
 *
 * One code, several reasons: a new way for registration to fail adds a reason here, while minting
 * a second code would break every client that branches on this one.
 */
export const UserRegistrationFailed = businessError({
  code: 'USER_REGISTRATION_FAILED',
  details: z.object({ email: email() }),
  reasons: {
    EMAIL_ALREADY_REGISTERED: 'A user with this email already exists',
    EMAIL_DOMAIN_BLOCKED: 'Registrations from this email domain are not accepted',
  },
});
