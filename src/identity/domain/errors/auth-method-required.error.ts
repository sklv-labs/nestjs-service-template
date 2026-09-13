import { businessError } from '@sklv-labs/nestjs-core/errors';
import { z } from 'zod';

/**
 * The invariant, surfaced: an active user must keep at least one way to sign in. Removing the last
 * one would lock the account permanently, and no row constraint can express a rule about the
 * number of rows that remain.
 */
export const AuthMethodRequired = businessError({
  code: 'AUTH_METHOD_REQUIRED',
  details: z.object({ userId: z.string() }),
  reasons: { LAST_METHOD: 'This is the only way to sign in and cannot be removed' },
});
