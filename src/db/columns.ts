import type { Uuid } from '@sklv-labs/core';
import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * A branded uuid primary key. Postgres generates a v7 value, so rows are inserted in roughly
 * chronological order and the index does not fragment the way v4 does.
 */
export const primaryUuid = <T extends Uuid>() =>
  uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`)
    .$type<T>();

/** `created_at` / `updated_at`, applied to every table. */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
