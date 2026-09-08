import type { Uuid } from '@sklv-labs/core';
import { primaryUuid, timestamps } from '@sklv-labs/nestjs-core/database';
import { pgTable, varchar } from 'drizzle-orm/pg-core';

export type UserId = Uuid<'users'>;

export const users = pgTable('users', {
  id: primaryUuid<UserId>(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),

  ...timestamps,
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
