import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { ClsStore } from 'nestjs-cls';
import { ClsModule as NestClsModule } from 'nestjs-cls';

import type { ClsModuleOptions } from './cls.options';
import { correlation as defaultCorrelation } from './correlation-id';
import { RequestContext } from './request-context';

/**
 * Wraps `nestjs-cls` with the parts every service ends up writing anyway.
 *
 * What this adds over importing `nestjs-cls` directly — and it is worth stating, because a wrapper
 * that adds nothing is worse than no wrapper:
 *
 * - An inbound correlation header becomes the context id, so a request crossing several services
 *   keeps one id. `nestjs-cls` generates a fresh id per process by default.
 * - That id is echoed on the response, so a caller can correlate from the response alone.
 * - Ids are on by default, because the id is what the logger and the error filters read.
 * - {@link RequestContext} for reading the context without repeating its two guards.
 *
 * The store itself stays empty. Anything an app wants in it goes through `setup`, and its shape is
 * the app's own `ClsStore` — this package never dictates fields.
 *
 * Global, because a request context that has to be imported per module is not a context.
 */
@Module({})
export class ClsModule {
  static forRoot<TStore extends ClsStore = ClsStore>(
    options: ClsModuleOptions<TStore> = {},
  ): DynamicModule {
    const correlation = options.correlation ?? defaultCorrelation;

    return {
      module: ClsModule,
      global: true,
      imports: [
        NestClsModule.forRoot({
          global: true,
          middleware: {
            mount: options.mount ?? true,
            generateId: true,
            // At the HTTP edge Fastify has already applied the same policy in `genReqId`, so
            // `req.id` is preferred: that keeps the framework's own lines and the application's on
            // one id. Any other transport falls back to the policy itself.
            idGenerator: (req: unknown) =>
              (req as { id?: string }).id ?? correlation.fromRequest(req),
            setup: async (cls, req: unknown, res: unknown) => {
              // Fastify's reply has `header`; a raw ServerResponse has `setHeader`. Nest hands
              // middleware the raw object, so both paths have to be covered.
              const reply = res as {
                header?: (k: string, v: string) => void;
                setHeader?: (k: string, v: string) => void;
              };

              (reply.header ?? reply.setHeader)?.call(reply, correlation.header, cls.getId());

              await options.setup?.(cls as never, req, res);
            },
          },
        }),
      ],
      providers: [RequestContext],
      exports: [NestClsModule, RequestContext],
    };
  }
}
