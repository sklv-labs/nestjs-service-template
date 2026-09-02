// oxlint-disable-next-line import/no-unassigned-import -- side effect is the point; must stay first
import './bootstrap-env';

import {
  Logger,
  StandardSchemaSerializerInterceptor,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { DomainErrorFilter } from './shared/http';
import { ConfigService } from './config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new Logger('Bootstrap');
  const config = app.get(ConfigService);

  app.use(helmet());
  app.enableShutdownHooks();
  app.setGlobalPrefix(config.globalPrefix);
  // Validates any @Body/@Query/@Param that carries a `schema`, and hands the handler the
  // parsed value. Strictness comes from the schemas themselves (`.strict()`), not from options.
  // validateCustomDecorators is required for @ReqHeaders — header schemas ride on a custom
  // param decorator, which the pipe skips by default.
  app.useGlobalPipes(new StandardSchemaValidationPipe({ validateCustomDecorators: true }));
  // Runs responses through the schema named by @SerializeOptions, which strips unknown keys.
  app.useGlobalInterceptors(new StandardSchemaSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new DomainErrorFilter());

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

  const url = await app.getUrl();
  logger.log(`Listening on ${url}/${config.globalPrefix}`);

  if (config.docs.enabled) {
    logger.log(`OpenAPI docs at ${url}/${config.docs.path}`);
  }
}

void bootstrap();
