import { z } from 'zod';

import { email, id, isoDate, paginated } from '../../../shared/contracts';
import type { UserId, UserRow } from '../../domain';

/**
 * The base user response. Every other user-shaped response extends or composes this, so a field
 * added here appears everywhere it should and nowhere it should not.
 */
export const userResponse = z.object({
  id: id<UserId>('Identifier of the user', { example: '01930000-0000-7000-8000-000000000000' }),
  email: email("The user's primary email address", { example: 'alex@example.com' }),
  createdAt: isoDate('When the user was created', { example: '2026-09-03T10:00:00.000Z' }),
  updatedAt: isoDate('When the user was last updated', { example: '2026-09-03T10:00:00.000Z' }),
});

export type UserResponse = z.infer<typeof userResponse>;

/** A trimmed shape for list rows — a list does not need every field a detail view has. */
export const userListItemResponse = userResponse.omit({ updatedAt: true });

export const userListResponse = paginated(userListItemResponse);

/** Extended with fields only an owner or admin may see. Composition, not a parallel contract. */
export const userDetailResponse = userResponse.extend({
  lastSeenAt: isoDate('When the user was last active', {
    example: '2026-09-03T09:00:00.000Z',
  }).nullable(),
});

/**
 * Row to response. The only place the persistence shape and the transport shape meet, and where
 * `Date` becomes an ISO string. `passwordHash` is absent here and stripped by the serializer
 * regardless, so it cannot leak by omission.
 */
export const toUserResponse = (row: UserRow): UserResponse => ({
  id: row.id,
  email: row.email,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
