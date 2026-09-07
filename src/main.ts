// oxlint-disable-next-line import/no-unassigned-import -- side effect is the point; must stay first
import './load-env';

import { randomUUID } from 'node:crypto';

import { StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { ConfigService } from './config';
import { registerRequestLogging } from './shared/http';
import { LoggerService } from './shared/logger';
import { logger } from './shared/logger/instance';
import { buildOpenApiDocument } from './shared/openapi';

const REQUEST_ID_HEADER = 'x-request-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Correlation ids are honoured from inbound requests so a trace spans services — but only when the
 * value is a UUID. Anything else is generated fresh: the header is caller-controlled, and an
 * arbitrary string ends up in every log line for the request, which is a way to inject junk (or
 * newlines, or kilobytes) into log storage.
 */
const correlationId = (value: string | string[] | undefined): string => {
  const candidate = Array.isArray(value) ? value[0] : value;

  return candidate && UUID.test(candidate) ? candidate : randomUUID();
};

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({
    // One instance for both: Fastify's access log and the application's own lines.
    loggerInstance: logger,
    // Ours replaces it: one detailed line per request instead of Fastify's incoming/completed pair.
    // Deprecated in Fastify 5.12 (FSTDEP023) and removed in 6, where it becomes
    // `logController: new LogController({ disableRequestLogging: true })`. Waiting: `LogController`
    // is exported by `fastify`, which is a peer of @nestjs/platform-fastify and deliberately not a
    // direct dependency here — two copies of Fastify broke @fastify/helmet's peer types before.
    disableRequestLogging: true,
    // Disabled so genReqId always runs — Fastify's own header extraction would accept any inbound
    // string, and correlationId validates it first. The result becomes `req.id`, which the CLS
    // wrapper adopts, so the access line and everything the handler logs share one id.
    requestIdHeader: false,
    genReqId: (req: { headers: Record<string, string | string[] | undefined> }) =>
      correlationId(req.headers[REQUEST_ID_HEADER]),
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
  });

  const loggerService = app.get(LoggerService);
  const config = app.get(ConfigService);

  app.useLogger(loggerService);
  registerRequestLogging(app, loggerService, {
    body: config.logging.requestBody,
    responseBody: config.logging.responseBody,
  });

  const { default: helmet } = await import('@fastify/helmet');
  await app.register(helmet);

  app.enableShutdownHooks();
  app.setGlobalPrefix(config.globalPrefix);
  // Validates any @Body/@Query/@Param carrying a schema. validateCustomDecorators is required for
  // @ReqHeaders, whose schema rides on a custom param decorator.
  app.useGlobalPipes(new StandardSchemaValidationPipe({ validateCustomDecorators: true }));

  if (config.docs.enabled) {
    SwaggerModule.setup(config.docs.path, app, buildOpenApiDocument(app, config.docs));
  }

  const { port, host } = config.server;
  await app.listen(port, host);

  logger.info({ url: await app.getUrl(), prefix: config.globalPrefix }, 'Service listening');
}

void bootstrap();
