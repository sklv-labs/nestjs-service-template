import { randomUUID } from 'node:crypto';

import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ClsModule as NestClsModule } from 'nestjs-cls';

import type { ClsModuleOptions } from './cls.options';
import { DEFAULT_REQUEST_ID_HEADER } from './cls.options';

type HeaderBag = Record<string, string | string[] | undefined>;

const readHeader = (req: unknown, header: string): string | undefined => {
  const bag = (req as { headers?: HeaderBag } | undefined)?.headers;
  const value = bag?.[header];

  return Array.isArray(value) ? value[0] : value;
};

/**
 * Wraps `nestjs-cls` with the parts every service ends up writing anyway.
 *
 * What this adds over importing `nestjs-cls` directly — and it is worth stating, because a wrapper
 * that adds nothing is worse than no wrapper:
 *
 * - An inbound correlation header becomes the context id, so a request crossing several services
 *   keeps one id. `nestjs-cls` generates a fresh id per process by default.
 * - That id is echoed on the response, so a caller can correlate from the response alone.
 * - Ids are on by default, because `cls.getId()` is what the logger reads.
 *
 * The store itself stays empty. Anything an app wants in it goes through `setup`, and its shape is
 * the app's own `ClsStore` interface — this package never dictates fields.
 */
@Module({})
export class ClsModule {
  static forRoot(options: ClsModuleOptions = {}): DynamicModule {
    const header = options.header ?? DEFAULT_REQUEST_ID_HEADER;
    const generate = options.generateId ?? randomUUID;

    return {
      module: ClsModule,
      imports: [
        NestClsModule.forRoot({
          global: true,
          middleware: {
            mount: options.mount ?? true,
            generateId: true,
            // Fastify has already assigned `req.id` from `genReqId`, so prefer it: that keeps the
            // framework's access log and the application's logs on the same id.
            idGenerator: (req: unknown) =>
              (req as { id?: string }).id ?? readHeader(req, header) ?? generate(),
            setup: async (cls, req: unknown, res: unknown) => {
              // Fastify's reply has `header`; a raw ServerResponse has `setHeader`. Nest hands
              // middleware the raw object, so both paths have to be covered.
              const reply = res as {
                header?: (k: string, v: string) => void;
                setHeader?: (k: string, v: string) => void;
              };

              (reply.header ?? reply.setHeader)?.call(reply, header, cls.getId());

              await options.setup?.(cls, req, res);
            },
          },
        }),
      ],
      exports: [NestClsModule],
    };
  }
}
