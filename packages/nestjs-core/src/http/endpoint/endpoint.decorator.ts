import {
  applyDecorators,
  Body,
  HttpCode,
  Param,
  Query,
  SerializeOptions,
  SetMetadata,
} from '@nestjs/common';
import { ApiBody, ApiHeaders, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { z } from 'zod';

import { openApiSchema } from '../../openapi';
import { RequestHeaders } from '../request';

import { ENDPOINT_METADATA } from './endpoint.constants';
import type { DocumentedEndpoint, ResponseSpec, SuccessSpec } from './endpoint.types';

const toResponseSpec = (success: SuccessSpec): ResponseSpec => ({
  status: success.status,
  description: success.description,
  schema: success.schema,
  ...(success.example === undefined
    ? {}
    : { examples: { default: { summary: success.description, value: success.example } } }),
});

/**
 * `.optional()` wraps a schema, so a description set before it sits on the inner type. Read through
 * one level so documented headers keep their description.
 */
const descriptionOf = (field: z.ZodType): string | undefined =>
  field.description ??
  (field as unknown as { def?: { innerType?: { description?: string } } }).def?.innerType
    ?.description;

/**
 * Wires an endpoint to a controller method: documentation, response contract, success status, and
 * the metadata the boot scan reads to map error codes to statuses.
 */
export const UseEndpoint = (e: DocumentedEndpoint) => {
  const decorators = [
    SetMetadata(ENDPOINT_METADATA, e),
    ApiOperation({ summary: e.summary, description: e.description }),
    ...[toResponseSpec(e.success), ...(e.errors ?? [])].map((r) =>
      ApiResponse({
        status: r.status,
        description: r.description,
        ...(r.schema ? { standardSchema: r.schema } : {}),
        ...(r.examples ? { examples: r.examples } : {}),
      }),
    ),
    HttpCode(e.success.status),
    SerializeOptions({ schema: e.success.schema }),
  ];

  if (e.request.body) {
    decorators.push(ApiBody({ schema: openApiSchema(e.request.body, 'input') }));
  }

  if (e.request.headers) {
    decorators.push(
      ApiHeaders(
        // `ApiHeaders` builds the parameter object itself, so without an explicit schema every
        // header documents as a bare string, losing its constraints and example.
        Object.entries(e.request.headers.shape).map(([name, field]) => ({
          name,
          description: descriptionOf(field),
          required: !field.safeParse(undefined).success,
          schema: openApiSchema(field, 'input'),
        })),
      ),
    );
  }

  return applyDecorators(...decorators);
};

/* Parameter decorators, reading their schema from the endpoint so a handler never repeats it. */
export const ReqBody = (e: DocumentedEndpoint) => Body({ schema: e.request.body });
export const ReqQuery = (e: DocumentedEndpoint) => Query({ schema: e.request.query });
export const ReqParams = (e: DocumentedEndpoint) => Param({ schema: e.request.params });
export const ReqHeaders = (e: DocumentedEndpoint) => RequestHeaders({ schema: e.request.headers });
