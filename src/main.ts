// oxlint-disable-next-line import/no-unassigned-import -- side effect is the point; must stay first
import './bootstrap-env';

import { randomUUID } from 'node:crypto';

import { StandardSchemaValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { ConfigService } from './config';
import { logger } from './logger';
import { registerRequestLogging } from './shared/http';
import { LoggerService } from './shared/logger';

const REQUEST_ID_HEADER = 'x-request-id';

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({
    // One instance for both: Fastify's access log and the application's own lines.
    loggerInstance: logger,
    // Fastify assigns this to `req.id` before routing, and the CLS wrapper adopts it — so an
    // access log line and everything the handler logs share one id, including for requests that
    // never reach Nest at all.
    // Fastify extracts the id from this header itself, so genReqId only runs when it is absent.
    // Ours replaces it: one detailed line per request instead of Fastify's incoming/completed pair.
    disableRequestLogging: true,
    requestIdHeader: REQUEST_ID_HEADER,
    genReqId: () => randomUUID(),
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
  });

  const loggerService = app.get(LoggerService);
  const config = app.get(ConfigService);

  app.useLogger(loggerService);
  registerRequestLogging(app, loggerService, { body: config.logging.requestBody });

  const { default: helmet } = await import('@fastify/helmet');
  await app.register(helmet);

  app.enableShutdownHooks();
  app.setGlobalPrefix(config.globalPrefix);
  // Validates any @Body/@Query/@Param carrying a schema. validateCustomDecorators is required for
  // @ReqHeaders, whose schema rides on a custom param decorator.
  app.useGlobalPipes(new StandardSchemaValidationPipe({ validateCustomDecorators: true }));

  if (config.docs.enabled) {
    const document = new DocumentBuilder()
      .setTitle(config.docs.title)
      .setDescription(config.docs.description)
      .setVersion(config.docs.version)
      .addBearerAuth()
      .build();

    SwaggerModule.setup(config.docs.path, app, SwaggerModule.createDocument(app, document));
  }

  const { port, host } = config.server;
  await app.listen(port, host);

  logger.info({ url: await app.getUrl(), prefix: config.globalPrefix }, 'Service listening');
}

void bootstrap();
