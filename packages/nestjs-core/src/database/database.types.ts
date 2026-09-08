import type { AnyRelations, EmptyRelations } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/**
 * The database client.
 *
 * Deliberately one dialect. A union of `NodePgDatabase | MySql2Database | ...` cannot be used
 * without narrowing at every call site, which is why the previous version cast through
 * `as unknown as` to escape its own type and then added a second type to undo the union. A second
 * dialect, if it ever arrives, is a second subpath.
 *
 * In Drizzle v1 the type parameter is the **relations**, not the schema: `schema` was removed from
 * the pg driver's config, and `db.query.*` is now driven by `defineRelations()`. A service that
 * defines relations types this as `Database<typeof relations>`; one that only uses
 * `select`/`insert`/`update` takes the default.
 */
export type Database<TRelations extends AnyRelations = EmptyRelations> = NodePgDatabase<TRelations>;
