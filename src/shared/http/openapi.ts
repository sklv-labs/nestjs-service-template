import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';

/**
 * Renders a contract as a raw OpenAPI schema.
 *
 * Needed only for `@ApiBody`, which takes a raw schema — `@ApiResponse` accepts a standard schema
 * directly. Use `'input'` for requests and `'output'` for responses; they differ wherever a
 * contract coerces, defaults, or strips unknown keys.
 */
export const openApiSchema = (schema: z.ZodType, io: 'input' | 'output'): SchemaObject =>
  z.toJSONSchema(schema, { target: 'openapi-3.0', io }) as SchemaObject;
