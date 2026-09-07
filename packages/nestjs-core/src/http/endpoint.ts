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

import type { BusinessErrorShape } from '../errors';
import { openApiSchema } from '../openapi';

import { businessErrorExamples, businessErrorResponse, errorResponse } from './error-contract';
import { RequestHeaders } from './request';

export type Example = { summary: string; value: unknown };
export type Examples = Record<string, Example>;

export type ResponseSpec = {
  status: number;
  description: string;
  schema?: z.ZodType;
  examples?: Examples;
  /** Set when the response documents a business error, so the boot scan can map its status. */
  errorCode?: string;
};

export type RequestSpec = {
  headers?: z.ZodObject;
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodObject;
};

/**
 * The response an endpoint succeeds with.
 *
 * Separate from the error list because it is not just another response — it is the contract of the
 * handler's output, which is what lets `toResponse` be checked against it. Keeping it in an array
 * also made "which 2xx is the real one" ambiguous.
 *
 * The schema is a `ZodObject` deliberately: Nest's serializer skips anything that is not a non-null
 * object, so a primitive or nullable contract would be documented but never enforced. This makes
 * that state unreachable.
 */
export type SuccessSpec<S extends z.ZodObject = z.ZodObject> = {
  status: number;
  schema: S;
  description: string;
  /** Type-checked against the schema. Prefer per-field examples via the field builders. */
  example?: z.input<S>;
};

/**
 * The parsed request, carrying only the parts the endpoint declares. An endpoint with no `query`
 * has no `query` key, so `toInput` cannot reach for something that was never validated.
 */
export type RequestParts<R extends RequestSpec> = (R['headers'] extends z.ZodObject
  ? { headers: z.infer<R['headers']> }
  : object) &
  (R['params'] extends z.ZodObject ? { params: z.infer<R['params']> } : object) &
  (R['query'] extends z.ZodObject ? { query: z.infer<R['query']> } : object) &
  (R['body'] extends z.ZodObject ? { body: z.infer<R['body']> } : object);

export type Endpoint<
  R extends RequestSpec = RequestSpec,
  S extends z.ZodObject = z.ZodObject,
  Input = unknown,
  Output = unknown,
> = {
  summary: string;
  description?: string;
  request: R;
  success: SuccessSpec<S>;
  errors?: ResponseSpec[];
  /**
   * Translates a validated request into the operation's input. This is the seam that keeps handlers
   * transport-agnostic: an RMQ consumer for the same operation writes its own version and the
   * handler is untouched.
   */
  toInput: (parts: RequestParts<R>) => Input;
  /**
   * Translates the operation's output into the response contract.
   *
   * Typed as the success schema's input, so a mapper that stops matching the contract is a compile
   * error rather than a 500 from the serializer at runtime.
   */
  toResponse: (output: Output) => z.input<S>;
};

/** What the decorators and the boot scan read. Drops the mapping functions, which they do not use. */
export type DocumentedEndpoint = {
  summary: string;
  description?: string;
  request: RequestSpec;
  success: SuccessSpec;
  errors?: ResponseSpec[];
};

/**
 * Describes one endpoint: what a request may carry, how it maps onto an operation, what success
 * looks like, and every way it can fail. Decorators, parameter schemas, handler types and the
 * OpenAPI document all derive from this single value.
 */
export const endpoint = <const R extends RequestSpec, S extends z.ZodObject, Input, Output>(
  def: Endpoint<R, S, Input, Output>,
): Endpoint<R, S, Input, Output> => def;

/** A transport-level failure with no business meaning — validation, auth, a missing route. */
export const failure = (status: number, description: string): ResponseSpec => ({
  status,
  description,
  schema: errorResponse,
});

/**
 * A business error response. Generates one example per reason from the messages on the error
 * declaration, and carries the code so the boot scan can map it to this status — no import-time
 * side effect and no global mutation at module load.
 */
export const httpError = <D extends z.ZodType>(
  status: number,
  error: BusinessErrorShape<D>,
  detailsExample: z.input<D>,
  description?: string,
): ResponseSpec => ({
  status,
  description: description ?? error.code,
  schema: businessErrorResponse(status, error),
  examples: businessErrorExamples(status, error, detailsExample),
  errorCode: error.code,
});

export const ENDPOINT_METADATA = 'sklv:endpoint';

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

/**
 * Handler parameter types, inferred from the endpoint's own `toInput` signature rather than from
 * the type parameters — `Input` sits in a return position, so an endpoint with a concrete input is
 * not assignable to one parameterised with `never`.
 */
type PartsOf<E> = E extends { toInput: (parts: infer P) => unknown } ? P : never;

export type BodyOf<E> = PartsOf<E> extends { body: infer T } ? T : never;
export type QueryOf<E> = PartsOf<E> extends { query: infer T } ? T : never;
export type ParamsOf<E> = PartsOf<E> extends { params: infer T } ? T : never;
export type HeadersOf<E> = PartsOf<E> extends { headers: infer T } ? T : never;

export type InputOf<E> = E extends { toInput: (parts: never) => infer I } ? I : never;
export type OutputOf<E> = E extends { toResponse: (output: infer O) => unknown } ? O : never;
