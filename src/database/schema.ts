/**
 * Every table in this service, re-exported for drizzle-kit.
 *
 * Tables live with the feature that owns them (`users/domain/users.table.ts`); this file exists so
 * migration generation has one entry point rather than a glob that silently matches nothing — as
 * `drizzle.config.ts` did until now.
 */
export * from '../users/domain/users.table';
