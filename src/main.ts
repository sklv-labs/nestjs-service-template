// oxlint-disable-next-line import/no-unassigned-import -- side effect is the point; must stay first
import './load-env';

import { StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { LogController } from 'fastify';
import { SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { ConfigService } from './config';
import { appContext } from './config/context';
import { fastifyContextOptions, registerRequestLogging } from '@sklv-labs/nestjs-core/http';
import { LoggerService } from '@sklv-labs/nestjs-core/logger';
import { logger } from './config/logger';
import { buildOpenApiDocument, contextHeaderParameters } from '@sklv-labs/nestjs-core/openapi';

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({
    loggerInstance: logger,
    // Ours replaces it: one detailed line per request instead of Fastify's incoming/completed
    // pair. The top-level `disableRequestLogging` option does the same thing but is deprecated
    // (FSTDEP023) and goes away in Fastify 6.

    logController: new LogController({ disableRequestLogging: true }),
    // Id creation, driven by the field declaration in `config/context.ts`. This is only where the
    // transport is handed it — Fastify has to decide `req.id` before any framework code runs.
    ...fastifyContextOptions(appContext),
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
    carrierHeaders: appContext.carrierNames,
  });

  const { default: helmet } = await import('@fastify/helmet');
  await app.register(helmet);

  app.enableShutdownHooks();
  app.setGlobalPrefix(config.globalPrefix);
  app.useGlobalPipes(new StandardSchemaValidationPipe({ validateCustomDecorators: true }));

  if (config.docs.enabled) {
    SwaggerModule.setup(
      config.docs.path,
      app,
      buildOpenApiDocument(app, config.docs, { parameters: contextHeaderParameters(appContext) }),
    );
  }

  const { port, host } = config.server;
  await app.listen(port, host);

  logger.info({ url: await app.getUrl(), prefix: config.globalPrefix }, 'Service listening');
}

void bootstrap();
