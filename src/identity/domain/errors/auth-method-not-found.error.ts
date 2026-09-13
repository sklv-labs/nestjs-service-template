import { businessError } from '@sklv-labs/nestjs-core/errors';
import { z } from 'zod';

export const AuthMethodNotFound = businessError({
  code: 'AUTH_METHOD_NOT_FOUND',
  details: z.object({ method: z.string() }),
  reasons: { NOT_LINKED: 'No such sign-in method on this account' },
});
