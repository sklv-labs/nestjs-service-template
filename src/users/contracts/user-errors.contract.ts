import { z } from 'zod';

import { businessError } from '../../contracts';

/**
 * One stable code, several reasons.
 *
 * A client branches on `errorCode`, which does not change as new causes are discovered. `reason`
 * narrows further, and adding a reason is not a breaking change the way minting a new code is.
 * This is the answer to "how do I document different business errors that share a status".
 */
export const UserRegistrationFailedSchema = businessError(
  409,
  'USER_REGISTRATION_FAILED',
  ['EMAIL_ALREADY_REGISTERED', 'EMAIL_DOMAIN_BLOCKED'],
  z.object({ email: z.email() }),
);

export type UserRegistrationFailed = z.infer<typeof UserRegistrationFailedSchema>;

export const USER_NOT_FOUND = 'USER_NOT_FOUND' as const;
export const USER_REGISTRATION_FAILED = 'USER_REGISTRATION_FAILED' as const;
