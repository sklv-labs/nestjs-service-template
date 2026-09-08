import { Inject } from '@nestjs/common';
import { InjectTransaction } from '@nestjs-cls/transactional';

import { DATABASE, PG_POOL } from './database.constants';

/**
 * Injects the transaction-aware client — what application code wants.
 *
 * Inside a `@Transactional()` method this resolves to the transaction; outside one, to the pool.
 * A repository therefore takes no transaction parameter and cannot be handed the wrong one.
 *
 * It requires `drizzleTransactionPlugin()` to be registered on the context module. Without it the
 * token does not resolve and the service fails to start — loudly, which is the point: the
 * alternative is what {@link InjectDatabaseClient} does.
 */
export const InjectDatabase = (): PropertyDecorator & ParameterDecorator => InjectTransaction();

/**
 * Injects the raw client, which is **not** transaction-aware.
 *
 * A write issued through this inside a `@Transactional()` method runs on its own connection and
 * commits even when the surrounding transaction rolls back — silently. That is not hypothetical:
 * this area's first repository was written against this token, and a probe that threw after an
 * insert still found the row committed.
 *
 * Use it only for work that must not join the caller's transaction — an audit row that has to
 * survive a rollback, say.
 */
export const InjectDatabaseClient = (): PropertyDecorator & ParameterDecorator => Inject(DATABASE);

/** Injects the raw `pg` pool — health probes, pool statistics, SQL that drizzle cannot express. */
export const InjectPool = (): PropertyDecorator & ParameterDecorator => Inject(PG_POOL);
