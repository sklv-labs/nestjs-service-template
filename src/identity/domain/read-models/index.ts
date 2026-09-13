import type { Email } from '../value-objects/email';
import type { OAuthAccountId, UserId } from '../value-objects/user-id';

/**
 * Read models: feature-owned, flat, no behaviour. They are produced by SQL projections rather than
 * by reconstructing an aggregate, and none of them can carry a password hash — the field is not on
 * the type, so omitting it is not something anyone has to remember.
 */

export type UserListItem = {
  id: UserId;
  email: Email;
  status: string;
  createdAt: Date;
};

export type CurrentUser = {
  id: UserId;
  email: Email;
  emailVerified: boolean;
  status: string;
  createdAt: Date;
};

export type AuthMethodSummary =
  | { kind: 'password'; updatedAt: Date }
  | { kind: 'oauth'; id: OAuthAccountId; provider: string; email: Email | null; linkedAt: Date };
