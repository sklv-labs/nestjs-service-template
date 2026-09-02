import type { Uuid } from '@sklv-labs/core';
import { pgTable, varchar } from 'drizzle-orm/pg-core';

import { primaryUuid, timestamps } from '../../../db/columns';

export type UserId = Uuid<'users'>;

export const users = pgTable('users', {
  id: primaryUuid<UserId>(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),

  ...timestamps,
});

export type UserSelect = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
