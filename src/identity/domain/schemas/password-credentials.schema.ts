import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import type { UserId } from '../value-objects/user-id';

import { users } from './users.schema';

/**
 * At most one per user, so the user id is the primary key — the invariant that would otherwise
 * need enforcing in code is a constraint here.
 *
 * The hash is a PHC string (`$argon2id$v=19$m=…,t=…,p=…$…`), which already encodes the algorithm
 * and its cost parameters. Separate columns for those would be a second copy that can disagree
 * with the hash they describe.
 */
export const passwordCredentials = pgTable('password_credentials', {
  userId: uuid('user_id')
    .$type<UserId>()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  hash: text('hash').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});
