import type { Uuid } from '@sklv-labs/core';
import { uuid } from '@sklv-labs/core/utils';

export type UserId = Uuid<'users'>;
export type OAuthAccountId = Uuid<'oauth_accounts'>;

/**
 * Ids are minted by the domain, not by the database.
 *
 * A database-generated id means an entity is invalid until it is saved: no object graph can be
 * built in memory, nothing can reference it before commit, and no test can construct one without
 * a connection. UUIDv7 keeps the index locality that a serial would have given.
 */
export const UserId = {
  next: (): UserId => uuid<UserId>(),
};

export const OAuthAccountId = {
  next: (): OAuthAccountId => uuid<OAuthAccountId>(),
};
