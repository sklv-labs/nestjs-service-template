import { z } from 'zod';

/**
 * The error body Nest produces. `errorCode` is populated by passing
 * `{ errorCode }` as the exception's options — see `HttpExceptionOptions`.
 *
 * Error responses do **not** pass through `StandardSchemaSerializerInterceptor`: exceptions
 * bypass the interceptor chain's success path. These schemas therefore document and type the
 * error contract for clients; they do not enforce it on the way out. An exception filter that
 * parses its own output is what would make that guarantee.
 */
export const ApiErrorSchema = z.object({
  statusCode: z.number().int().describe('HTTP status code'),
  message: z.union([z.string(), z.array(z.string())]).describe('Human-readable explanation'),
  error: z.string().optional().describe('HTTP status text'),
  errorCode: z
    .string()
    .optional()
    .describe('Stable machine-readable code for clients to branch on'),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * Builds a error contract for one stable `errorCode` that can occur for several distinct
 * business reasons. Clients branch on `errorCode`; `reason` narrows further without inventing
 * a new code per scenario, which keeps the code stable as reasons are added.
 */
export const businessError = <
  Code extends string,
  Reasons extends readonly [string, ...string[]],
  Details extends z.ZodType,
>(
  statusCode: number,
  code: Code,
  reasons: Reasons,
  details: Details,
) =>
  ApiErrorSchema.extend({
    statusCode: z.literal(statusCode),
    errorCode: z.literal(code),
    reason: z.enum(reasons).describe('Which of the cases behind this code occurred'),
    details,
  });
