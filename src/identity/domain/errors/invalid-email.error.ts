import { businessError } from '@sklv-labs/nestjs-core/errors';
import { z } from 'zod';

export const InvalidEmail = businessError({
  code: 'INVALID_EMAIL',
  details: z.object({ email: z.string() }),
  reasons: { MALFORMED: 'That is not a valid email address' },
});
