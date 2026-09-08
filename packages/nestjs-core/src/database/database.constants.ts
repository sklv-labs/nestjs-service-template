/** The drizzle client. Transaction-aware when the transactional plugin is registered. */
export const DATABASE = Symbol('DATABASE');

/** The underlying `pg` pool — for health probes and anything needing raw SQL or pool stats. */
export const PG_POOL = Symbol('PG_POOL');
