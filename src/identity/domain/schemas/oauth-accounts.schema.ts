import { primaryUuid } from '@sklv-labs/nestjs-core/database';
import { pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

import type { OAuthAccountId, UserId } from '../value-objects/user-id';

import { users } from './users.schema';

/**
 * One table for every OIDC/OAuth provider, because they share a shape. Adding a provider is a
 * configuration entry and a class — no migration.
 *
 * `providerAccountId` is the provider's stable subject (Google's `sub`, GitHub's numeric id),
 * never the email: addresses change hands, subjects do not.
 */
export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: primaryUuid<OAuthAccountId>(),
    userId: uuid('user_id')
      .$type<UserId>()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    /** As the provider reported it, for display. Not an identity, and never used to match users. */
    email: varchar('email', { length: 320 }),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    unique('oauth_accounts_provider_account_key').on(table.provider, table.providerAccountId),
  ],
);
