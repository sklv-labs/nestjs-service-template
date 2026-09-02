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
  schema: './src/**/domain/schemas/*.schema.ts',
  dialect: 'postgresql',
  casing: 'snake_case',
  dbCredentials: { url },
  migrations: { table: 'migrations', schema: 'public' },
  strict: true,
  verbose: true,
});
