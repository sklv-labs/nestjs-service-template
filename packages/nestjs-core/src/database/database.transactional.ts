import type { DynamicModule, Type } from '@nestjs/common';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';

import { DATABASE } from './database.constants';
import type { Database } from './database.types';

/**
 * Transaction propagation through the request context.
 *
 * Register it on the context module — `ContextModule.forRoot({ registry, plugins: [...] })` — and
 * `@Transactional()` then wraps a method in a transaction that every injected client inside it
 * joins, however deep the call goes. Without it, a transaction handle has to be threaded through
 * the operation and service layers, and forgetting one is silent.
 *
 * This is `@nestjs-cls/transactional` rather than something hand-rolled: it is the same async
 * local storage the context already runs on, and propagation-with-nesting is a problem worth not
 * re-solving.
 */
export const drizzleTransactionPlugin = (
  options: {
    /** Modules providing `DATABASE`, if it is not global. */
    imports?: (Type | DynamicModule)[];
    /** Make the injected client itself transaction-aware. On by default. */
    enableTransactionProxy?: boolean;
  } = {},
): ClsPluginTransactional =>
  new ClsPluginTransactional({
    imports: options.imports ?? [],
    adapter: new TransactionalAdapterDrizzleOrm<Database>({ drizzleInstanceToken: DATABASE }),
    enableTransactionProxy: options.enableTransactionProxy ?? true,
  });

// Re-exported so a consumer has one import site for the whole database surface.
export {
  InjectTransactionHost,
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
