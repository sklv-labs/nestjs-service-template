import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';

import { AppModule } from '../src/app.module';
import { ConfigService } from '../src/config';
import { buildOpenApiDocument } from '../src/shared/openapi';

/**
 * Writes `openapi.json` without starting a server.
 *
 * Committed, so a contract change shows up in review as a diff someone reads, and CI can fail when
 * the document drifts from the code. It is also what an SDK generator or a Bruno collection is
 * built from.
 *
 * The environment comes from `.env.example` via `node --env-file-if-exists`, not from `.env`:
 * building the module graph runs config validation, and a committed artefact must not depend on
 * whatever a particular machine happens to have configured. Real environment variables still win,
 * because Node does not let the file override them.
 */
async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, new FastifyAdapter(), { logger: false });
  const config = app.get(ConfigService);

  app.setGlobalPrefix(config.globalPrefix);
  // Lifecycle hooks run, so the endpoint scan reports unmapped error codes here too.
  await app.init();

  const document = buildOpenApiDocument(app, config.docs);
  const target = resolve(process.cwd(), 'openapi.json');

  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();

  process.stdout.write(`openapi.json written (${Object.keys(document.paths).length} paths)\n`);
}

void main();
