import { createParamDecorator } from '@nestjs/common';

type WithHeaders = { headers: Record<string, string | string[] | undefined> };

/**
 * Builders for the four parts of a request, namespaced so they do not collide with the request part
 * names an endpoint's `toInput` destructures.
 *
 * `body` is strict: an unknown key is a 400 rather than a silently dropped field. `query`, `params`
 * and `headers` are not, because proxies, clients and browsers all add their own.
 */
import { z } from 'zod';

export const req = {
  body: <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict(),
  query: <T extends z.ZodRawShape>(shape: T) => z.object(shape),
  params: <T extends z.ZodRawShape>(shape: T) => z.object(shape),
  headers: <T extends z.ZodRawShape>(shape: T) => z.object(shape),
};

/**
 * `@Headers()` is the one request part Nest will not attach a schema to, so this custom decorator
 * supplies them and the pipe validates — which needs `validateCustomDecorators: true`.
 *
 * Typed structurally rather than against Fastify, so nothing here depends on the adapter.
 */
export const RequestHeaders = createParamDecorator(
  (_data: unknown, ctx) => ctx.switchToHttp().getRequest<WithHeaders>().headers,
);
