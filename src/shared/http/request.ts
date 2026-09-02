import { createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

/**
 * `@Headers()` is the one request part Nest will not attach a schema to, so this custom decorator
 * supplies the headers and the pipe validates them — which needs `validateCustomDecorators: true`
 * on `StandardSchemaValidationPipe`.
 *
 * Header names are lower-cased by Node, so contracts must spell them that way.
 */
export const RequestHeaders = createParamDecorator(
  (_data: unknown, ctx) => ctx.switchToHttp().getRequest<Request>().headers,
);
