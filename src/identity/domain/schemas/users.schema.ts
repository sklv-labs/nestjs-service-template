import { primaryUuid, timestamps } from '@sklv-labs/nestjs-core/database';
import { integer, pgEnum, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

import type { UserId } from '../value-objects/user-id';

export const userStatus = pgEnum('user_status', ['active', 'suspended']);

export const users = pgTable('users', {
  id: primaryUuid<UserId>(),
  // 320 is the practical maximum for an address; stored normalised, so the unique index is the
  // one that matters rather than a case-insensitive collation.
  email: varchar('email', { length: 320 }).notNull().unique(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  status: userStatus('status').notNull().default('active'),
  /** Optimistic lock. Checked in the update predicate, advanced on every save. */
  version: integer('version').notNull().default(0),

  ...timestamps,
});
