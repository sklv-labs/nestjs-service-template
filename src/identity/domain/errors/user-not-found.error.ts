import { businessError } from '@sklv-labs/nestjs-core/errors';
import { z } from 'zod';

export const UserNotFound = businessError({
  code: 'USER_NOT_FOUND',
  details: z.object({ id: z.string() }),
  reasons: { BY_ID: 'No user exists with that id' },
});
