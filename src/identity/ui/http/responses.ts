import { email, id, isoDate, oneOf, paginated } from '@sklv-labs/nestjs-core/contracts';
import { z } from 'zod';

import type { CurrentUser, UserListItem } from '../../domain/read-models';
import type { UserId } from '../../domain/value-objects/user-id';

/**
 * Response representations for this resource, shared across endpoints because they scale with
 * representations rather than with routes.
 *
 * No shape here has a password field. That is structural rather than remembered: these map from
 * read models, which do not carry one.
 */
export const userResponse = z
  .object({
    id: id<UserId>('Identifier of the user', { example: '01930000-0000-7000-8000-000000000000' }),
    email: email("The user's primary email address", { example: 'alex@example.com' }),
    emailVerified: z.boolean().describe('Whether the address has been confirmed'),
    status: oneOf(['active', 'suspended'], 'Account status', { example: 'active' }),
    createdAt: isoDate('When the user was created', { example: '2026-09-13T10:00:00.000Z' }),
  })
  .meta({ id: 'User' });

export type UserResponse = z.infer<typeof userResponse>;

/** A trimmed shape for list rows — a list does not need every field a detail view has. */
export const userListItemResponse = userResponse
  .omit({ emailVerified: true })
  .meta({ id: 'UserListItem' });

export const userListResponse = paginated(userListItemResponse, 'UserList');

export const toUserResponse = (user: CurrentUser): UserResponse => ({
  id: user.id,
  email: user.email,
  emailVerified: user.emailVerified,
  status: user.status,
  createdAt: user.createdAt.toISOString(),
});

export const toUserListItemResponse = (user: UserListItem) => ({
  id: user.id,
  email: user.email,
  status: user.status,
  createdAt: user.createdAt.toISOString(),
});
