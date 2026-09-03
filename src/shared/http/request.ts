import { createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';

/**
 * Builders for the four parts of a request, namespaced so they do not collide with the request
 * part names an endpoint's `toInput` destructures.
 *
 * `body` is strict: an unknown key is a 400 rather than a silently dropped field. `query`,
 * `params` and `headers` are not, because proxies, clients and browsers all add their own.
 */
export const req = {
  body: <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict(),
  query: <T extends z.ZodRawShape>(shape: T) => z.object(shape),
  params: <T extends z.ZodRawShape>(shape: T) => z.object(shape),
  headers: <T extends z.ZodRawShape>(shape: T) => z.object(shape),
};

/**
 * `@Headers()` is the one request part Nest does not let you attach a schema to, so this custom
 * decorator supplies the headers and the pipe validates it — which requires
 * `validateCustomDecorators: true` on `StandardSchemaValidationPipe`.
 *
 * Header names are lower-cased by Node, so contracts must spell them that way.
 */
export const RequestHeaders = createParamDecorator(
  (_data: unknown, ctx) => ctx.switchToHttp().getRequest<Request>().headers,
);
