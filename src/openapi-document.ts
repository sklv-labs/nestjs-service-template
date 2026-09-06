import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import type { ConfigService } from './config';

/**
 * Builds the OpenAPI document.
 *
 * Shared by the running service and the generator script so the served document and the committed
 * `openapi.json` cannot describe different APIs.
 */
export const buildOpenApiDocument = (
  app: INestApplication,
  config: ConfigService,
): OpenAPIObject => {
  const builder = new DocumentBuilder()
    .setTitle(config.docs.title)
    .setDescription(config.docs.description)
    .setVersion(config.docs.version)
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(app, builder);
};
