import { AsyncLocalStorage } from 'node:async_hooks';

import { CLS_ID, ClsService } from 'nestjs-cls';

import { carrierReader } from '../carriers';
import { CONTEXT_BINDINGS } from '../context.constants';
import { Context } from '../context.service';
import type { ContextFields, ContextRegistry, StoreOf } from '../context.types';

/**
 * Runs a callback inside a populated context, with no transport involved.
 *
 * This is what a unit test needs and what a scheduled job needs: entering a context is otherwise
 * only possible by receiving a request. The store is built exactly as the module's middleware
 * builds it — generators run, then the given values are applied — so a test cannot pass because it
 * assembled the context differently from production.
 *
 * Pass `cls` to join an existing application's context service; omit it for an isolated one.
 */
export const runWithContext = <F extends ContextFields, T>(
  registry: ContextRegistry<F>,
  values: Partial<StoreOf<F>>,
  run: (context: Context<F>) => T,
  options: { cls?: ClsService } = {},
): T => {
  const cls = options.cls ?? new ClsService(new AsyncLocalStorage());
  const store = { ...registry.extract(carrierReader({})), ...values } as StoreOf<F>;

  return cls.run(() => {
    if (registry.idKey !== undefined) {
      cls.set(CLS_ID, (store as Record<string, unknown>)[registry.idKey]);
    }

    for (const [key, value] of Object.entries(store)) {
      cls.set(key, value);
    }

    cls.set(CONTEXT_BINDINGS, registry.bindings(store));

    return run(new Context(cls as never, registry));
  });
};

/** A context service with nothing active, for asserting the outside-a-context behaviour. */
export const inactiveContext = <F extends ContextFields>(
  registry?: ContextRegistry<F>,
): Context<F> => new Context(new ClsService(new AsyncLocalStorage()) as never, registry);
