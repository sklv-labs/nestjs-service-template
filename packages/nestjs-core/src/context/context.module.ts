import { randomUUID } from 'node:crypto';

import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { ClsService } from 'nestjs-cls';
import { ClsModule as NestClsModule } from 'nestjs-cls';

import { headersCarrier } from './carrier';
import type { CarrierReader } from './carrier';
import { CONTEXT_BINDINGS, CONTEXT_REGISTRY, Context } from './context.service';
import type { ContextFields, ContextRegistry, StoreOf, Trust } from './registry';

export type ContextModuleOptions<F extends ContextFields> = {
  registry: ContextRegistry<F>;
  /**
   * How much the transport this is mounted on is trusted. An internet-facing HTTP server is
   * `edge` — the default, because assuming otherwise is the mistake that leaks data. A listener
   * reachable only from the mesh passes `internal`, and only then are `internal` fields honoured.
   */
  trust?: Trust;
  /** Where the carrier lives on the transport's request object. Defaults to its `headers`. */
  carrierOf?: (req: unknown) => CarrierReader;
  /** An inbound value was present but failed its contract, and was discarded. */
  onRejected?: (field: string, raw: string) => void;
  /** Runs after the context is populated, for anything the declaration cannot express. */
  setup?: (cls: ClsService<StoreOf<F>>, req: unknown, res: unknown) => void | Promise<void>;
  /** Mount the context on every route. Off only for tests that drive services directly. */
  mount?: boolean;
};

type Reply = {
  header?: (name: string, value: string) => void;
  setHeader?: (name: string, value: string) => void;
};

/**
 * Populates the context from whatever the transport carries, and nothing more.
 *
 * `nestjs-cls` provides the async-local storage and four entry points — middleware (HTTP), guard
 * and interceptor (any `ExecutionContext`, so RPC and WebSockets), and `@UseCls()` (an arbitrary
 * method, so a queue processor). This mounts the HTTP one; the others reuse the same
 * `registry.extract` over their own carrier, which is the point of the carrier abstraction.
 *
 * Global, because a context that has to be imported per module is not a context.
 */
@Module({})
export class ContextModule {
  static forRoot<const F extends ContextFields>(options: ContextModuleOptions<F>): DynamicModule {
    const { registry } = options;
    const trust = options.trust ?? 'edge';
    const carrierOf = options.carrierOf ?? headersCarrier;
    const extractOptions = { trust, onRejected: options.onRejected };

    return {
      module: ContextModule,
      global: true,
      imports: [
        NestClsModule.forRoot({
          global: true,
          middleware: {
            mount: options.mount ?? true,
            generateId: true,
            // A transport may have decided the id before any framework code ran — Fastify assigns
            // `req.id` from `genReqId`, and it is what the framework's own lines carry. Preferring
            // it is what keeps one id across those lines and ours; anything else applies the same
            // declaration the transport would have.
            idGenerator: (req: unknown) =>
              (req as { id?: string }).id ??
              registry.extractId(carrierOf(req), extractOptions) ??
              randomUUID(),
            setup: async (cls, req: unknown, res: unknown) => {
              const store = registry.extract(carrierOf(req), {
                ...extractOptions,
                overrides: (registry.idKey === undefined
                  ? {}
                  : { [registry.idKey]: cls.getId() }) as Partial<StoreOf<F>>,
              });

              for (const [key, value] of Object.entries(store)) {
                cls.set(key, value);
              }

              // Computed once here rather than per log line.
              cls.set(CONTEXT_BINDINGS, registry.bindings(store));

              const reply = res as Reply;
              const outbound = registry.headers(store);

              for (const name of registry.echoNames) {
                const value = outbound[name];

                if (value !== undefined) {
                  // Fastify's reply has `header`; a raw ServerResponse has `setHeader`. Nest hands
                  // middleware the raw object, so both paths have to be covered.
                  (reply.header ?? reply.setHeader)?.call(reply, name, value);
                }
              }

              await options.setup?.(cls as never, req, res);
            },
          },
        }),
      ],
      providers: [{ provide: CONTEXT_REGISTRY, useValue: registry }, Context],
      exports: [NestClsModule, CONTEXT_REGISTRY, Context],
    };
  }
}
