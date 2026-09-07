import { createParamDecorator } from '@nestjs/common';

type WithHeaders = { headers: Record<string, string | string[] | undefined> };

/**
 * `@Headers()` is the one request part Nest will not attach a schema to, so this custom decorator
 * supplies them and the pipe validates — which needs `validateCustomDecorators: true`.
 *
 * Typed structurally rather than against Fastify, so nothing here depends on the adapter.
 */
export const RequestHeaders = createParamDecorator(
  (_data: unknown, ctx) => ctx.switchToHttp().getRequest<WithHeaders>().headers,
);
