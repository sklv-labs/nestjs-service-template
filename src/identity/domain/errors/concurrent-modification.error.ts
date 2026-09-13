import { businessError } from '@sklv-labs/nestjs-core/errors';
import { z } from 'zod';

/**
 * Someone else wrote this aggregate between our read and our write.
 *
 * Raised by the repository when the optimistic lock does not match. It is a domain-visible outcome
 * rather than an infrastructure detail: the caller's decision was made against state that no
 * longer holds, and retrying is the only honest answer.
 */
export const ConcurrentModification = businessError({
  code: 'CONCURRENT_MODIFICATION',
  details: z.object({ id: z.string() }),
  reasons: { STALE_VERSION: 'This record changed while you were editing it' },
});
