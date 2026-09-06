import { baseEnvSchema } from '@sklv-labs/nestjs-config';
import { z } from 'zod';

export const validationSchema = baseEnvSchema.extend({
  DATABASE_URL: z.url(),

  DOCS_ENABLED: z.stringbool().default(true),
  DOCS_PATH: z.string().default('api/docs'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /** Structured output. Off locally for readability, on everywhere else so logs stay queryable. */
  LOG_JSON: z.stringbool().default(true),
});

export type EnvType = z.infer<typeof validationSchema>;
