import path from 'node:path';

import { loadEnv } from '@sklv-labs/nestjs-config';
import { defineConfig } from 'drizzle-kit';

loadEnv({ config: { path: path.resolve(process.cwd(), '.env') }, silent: true });

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');
}

export default defineConfig({
  out: './drizzle',
  // Every table in the codebase, by convention rather than by a barrel someone has to remember to
  // update. A file matched here is a table definition and nothing else: relations live beside it
  // as `*.relations.ts`, deliberately outside the glob, because drizzle-kit has no use for them —
  // foreign keys come from `references()` on the columns, not from the relations config.
  schema: './src/**/domain/schemas/*.schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url },
  migrations: { table: 'migrations', schema: 'public' },
  verbose: true,
});
