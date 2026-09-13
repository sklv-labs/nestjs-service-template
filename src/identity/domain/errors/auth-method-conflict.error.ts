import { businessError } from '@sklv-labs/nestjs-core/errors';
import { z } from 'zod';

/** A sign-in method cannot be attached as asked. */
export const AuthMethodConflict = businessError({
  code: 'AUTH_METHOD_CONFLICT',
  details: z.object({ provider: z.string() }),
  reasons: {
    ALREADY_LINKED: 'An account from this provider is already linked',
    LINKED_TO_ANOTHER_USER: 'That provider account belongs to a different user',
  },
});
