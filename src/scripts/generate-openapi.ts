// oxlint-disable-next-line import/no-unassigned-import -- must load the environment before Nest
import '../bootstrap-env';

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';

import { AppModule } from '../app.module';
import { ConfigService } from '../config';
import { buildOpenApiDocument } from '../openapi-document';

/**
 * Writes `openapi.json` without starting a server.
 *
 * Committed, so a contract change shows up in review as a diff someone reads, and CI can fail when
 * the document drifts from the code. It is also what an SDK generator or a Bruno collection is
 * built from.
 */
async function main(): Promise<void> {
  // The document only needs the module graph, not a database, but config validation still runs —
  // so anything required gets a placeholder rather than forcing a real environment to exist.
  process.env.DATABASE_URL ??= 'postgres://user:pass@localhost:5432/placeholder';

  const app = await NestFactory.create(AppModule, new FastifyAdapter(), { logger: false });
  const config = app.get(ConfigService);

  app.setGlobalPrefix(config.globalPrefix);
  await app.init();

  const document = buildOpenApiDocument(app, config);
  const target = resolve(process.cwd(), 'openapi.json');

  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();

  process.stdout.write(`openapi.json written (${Object.keys(document.paths).length} paths)\n`);
}

void main();
