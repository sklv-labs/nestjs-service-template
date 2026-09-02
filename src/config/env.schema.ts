import { baseEnvSchema } from '@sklv-labs/nestjs-config';
import { z } from 'zod';

export const validationSchema = baseEnvSchema.extend({
  DATABASE_URL: z.string().url(),

  DOCS_ENABLED: z.stringbool().default(true),
  DOCS_PATH: z.string().default('api/docs'),
});

export type EnvType = z.infer<typeof validationSchema>;
