import { z } from 'zod';

import { paginated } from '../../contracts';

import { UserIdSchema } from './user-id.contract';

/**
 * The output contract, and the only definition of what a user looks like over HTTP.
 *
 * Two things to keep in mind:
 *
 * - Timestamps are `z.iso.datetime()`, not `z.date()`. `z.date()` has no JSON Schema
 *   representation and makes OpenAPI generation throw, so the boundary speaks ISO strings and
 *   whatever produces the response converts.
 * - There is no `passwordHash` field. Because zod strips unknown keys, the serializer removes it
 *   even if a repository or service starts returning it — the omission is enforced, not a
 *   convention someone has to remember.
 */
export const UserResponseSchema = z.object({
  id: UserIdSchema,
  email: z.email().describe("The user's primary email address"),
  createdAt: z.iso.datetime().describe('When the user was created'),
  updatedAt: z.iso.datetime().describe('When the user was last updated'),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;

export const UserListResponseSchema = paginated(UserResponseSchema);
export type UserListResponse = z.infer<typeof UserListResponseSchema>;
