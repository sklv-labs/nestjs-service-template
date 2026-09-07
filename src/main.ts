// oxlint-disable-next-line import/no-unassigned-import -- side effect is the point; must stay first
import './load-env';

import { StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { ConfigService } from './config';
import { fastifyCorrelationOptions } from './shared/cls';
import { registerRequestLogging } from './shared/http';
import { LoggerService } from './shared/logger';
import { logger } from './shared/logger/instance';
import { buildOpenApiDocument } from './shared/openapi';

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
    // Correlation id creation, owned by `shared/cls` — the policy and the context that carries it
    // belong together, and this is only the point where the transport is handed it.
    ...fastifyCorrelationOptions(),
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
