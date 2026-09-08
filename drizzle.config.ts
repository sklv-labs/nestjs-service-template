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
  // The barrel, not a glob. The previous value — './src/**/domain/schemas/*.schema.ts' — matched
  // no file in this repository, so migration generation had never seen a table.
  schema: './src/database/schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url },
  migrations: { table: 'migrations', schema: 'public' },
  verbose: true,
});
