import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Renders a contract as a raw OpenAPI schema object.
 *
 * Needed only for `@ApiBody`, which takes a raw schema rather than a standard schema — unlike
 * `@ApiResponse`, which accepts `standardSchema` directly. Nest already documents the request
 * body from `@Body({ schema })`; this exists so a body can also carry named examples, which
 * `@ApiBody` only accepts alongside an inline `schema`.
 *
 * Use `'input'` for requests and `'output'` for responses: the two differ wherever a contract
 * coerces, defaults, or strips unknown keys.
 */
export const openApiSchema = (schema: z.ZodType, io: 'input' | 'output'): SchemaObject =>
  z.toJSONSchema(schema, { target: 'openapi-3.0', io }) as SchemaObject;
