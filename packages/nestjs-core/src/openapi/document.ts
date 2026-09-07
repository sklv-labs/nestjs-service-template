import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Identity of the documented API. Plain data, so this file stays independent of app config. */
export type OpenApiMetadata = {
  title: string;
  description: string;
  version: string;
};

/**
 * Builds the OpenAPI document.
 *
 * Shared by the running service and the generator script so the served document and the committed
 * `openapi.json` cannot describe different APIs. Metadata is passed in rather than read from
 * `ConfigService`: the document must come out byte-identical wherever it is generated, so nothing
 * about the current environment may leak into it.
 */
export const buildOpenApiDocument = (
  app: INestApplication,
  metadata: OpenApiMetadata,
): OpenAPIObject => {
  const builder = new DocumentBuilder()
    .setTitle(metadata.title)
    .setDescription(metadata.description)
    .setVersion(metadata.version)
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(app, builder);
};
