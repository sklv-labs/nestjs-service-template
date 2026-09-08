import { timestamp } from 'drizzle-orm/pg-core';

/**
 * `created_at` / `updated_at`, applied to every table.
 *
 * `withTimezone` because a timestamp without one is a timestamp in an unknown zone, and
 * `$onUpdate` so `updated_at` cannot be forgotten at a call site.
 */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
