import { applyDecorators, Body, HttpCode, Param, Query, SerializeOptions } from '@nestjs/common';
import { ApiBody, ApiHeaders, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { z } from 'zod';

import type { BusinessErrorShape } from '../errors';

import {
  businessErrorExamples,
  businessErrorResponse,
  errorResponse,
  mapErrorStatus,
} from './error-response';
import { openApiSchema } from './openapi';
import { RequestHeaders } from './request';

export type Example = { summary: string; value: unknown };
export type Examples = Record<string, Example>;

export type ResponseSpec = {
  status: number;
  description: string;
  schema?: z.ZodType;
  examples?: Examples;
};

export type RequestSpec = {
  headers?: z.ZodObject;
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodObject;
  /** A sample request payload, shown in the documentation. */
  example?: unknown;
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

export type Endpoint<R extends RequestSpec = RequestSpec, Input = unknown, Output = unknown> = {
  summary: string;
  description?: string;
  request: R;
  responses: ResponseSpec[];
  /**
   * Translates a validated request into the operation's input. This is the seam that keeps handlers
   * transport-agnostic: an RMQ consumer for the same operation writes its own version of this and
   * the handler is untouched.
   */
  toInput: (parts: RequestParts<R>) => Input;
  /** Translates the operation's output into the response contract. */
  toResponse: (output: Output) => unknown;
};

/**
 * What the decorators read. Deliberately drops the two mapping functions: a specific endpoint is
 * not assignable to `Endpoint<RequestSpec, unknown, unknown>` because function parameters are
 * contravariant, and the decorators do not use them.
 */
export type DocumentedEndpoint = {
  summary: string;
  description?: string;
  request: RequestSpec;
  responses: ResponseSpec[];
};

/**
 * Describes one endpoint in one place: what a request may carry, how it maps onto an operation, and
 * every response it can produce. Decorators, parameter schemas, handler types and the OpenAPI
 * document all derive from this single value.
 */
export const endpoint = <const R extends RequestSpec, Input, Output>(
  def: Endpoint<R, Input, Output>,
): Endpoint<R, Input, Output> => def;

/** A success response. One positional example — a named map is rarely worth the nesting. */
export const success = (
  status: number,
  schema: z.ZodType,
  description: string,
  example?: unknown,
): ResponseSpec => ({
  status,
  description,
  schema,
  ...(example === undefined
    ? {}
    : { examples: { default: { summary: description, value: example } } }),
});

/** A transport-level failure with no business meaning — validation, auth, a missing route. */
export const failure = (status: number, description: string): ResponseSpec => ({
  status,
  description,
  schema: errorResponse,
});

/**
 * A business error response. Declaring it also maps the code to this status at runtime, so the
 * documented status and the one the filter returns cannot disagree, and generates one example per
 * reason from the messages on the error declaration.
 */
export const httpError = <D extends z.ZodType>(
  status: number,
  error: BusinessErrorShape<D>,
  detailsExample: z.input<D>,
  description?: string,
): ResponseSpec => {
  mapErrorStatus(error.code, status);

  return {
    status,
    description: description ?? error.code,
    schema: businessErrorResponse(status, error),
    examples: businessErrorExamples(status, error, detailsExample),
  };
};

/**
 * `.optional()` wraps a schema, so a description set before it sits on the inner type. Read through
 * one level of wrapping so documented headers keep their description.
 */
const descriptionOf = (field: z.ZodType): string | undefined =>
  field.description ??
  (field as unknown as { def?: { innerType?: { description?: string } } }).def?.innerType
    ?.description;

/**
 * The response the endpoint succeeds with. Its schema is the serialization contract and its status
 * is the status to return, so neither needs restating on the controller.
 *
 * An endpoint with several 2xx entries is ambiguous; the first wins, which is why declaring more
 * than one success response is a smell rather than a feature.
 */
const successResponse = (e: DocumentedEndpoint): ResponseSpec | undefined =>
  e.responses.find((r) => r.status >= 200 && r.status < 300);

/**
 * Wires an endpoint to a controller method: its documentation, its response contract and its
 * success status.
 *
 * Everything comes from the descriptor, so a handler names its endpoint once. Restating the
 * response schema in `@SerializeOptions` or the status in `@HttpCode` is how they drift.
 */
export const UseEndpoint = (e: DocumentedEndpoint) => {
  const decorators = [
    ApiOperation({ summary: e.summary, description: e.description }),
    ...e.responses.map((r) =>
      ApiResponse({
        status: r.status,
        description: r.description,
        ...(r.schema ? { standardSchema: r.schema } : {}),
        ...(r.examples ? { examples: r.examples } : {}),
      }),
    ),
  ];

  if (e.request.body) {
    decorators.push(
      ApiBody({
        schema: openApiSchema(e.request.body, 'input'),
        ...(e.request.example === undefined
          ? {}
          : { examples: { standard: { summary: 'Example request', value: e.request.example } } }),
      }),
    );
  }

  if (e.request.headers) {
    decorators.push(
      ApiHeaders(
        Object.entries(e.request.headers.shape).map(([name, field]) => ({
          name,
          description: descriptionOf(field),
          required: !field.safeParse(undefined).success,
        })),
      ),
    );
  }

  const ok = successResponse(e);

  if (ok) {
    decorators.push(HttpCode(ok.status));

    if (ok.schema) {
      decorators.push(SerializeOptions({ schema: ok.schema }));
    }
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
 * the `Endpoint` type parameters — `Input` sits in a return position, so an endpoint with a
 * concrete input is not assignable to one parameterised with `never`.
 */
type PartsOf<E> = E extends { toInput: (parts: infer P) => unknown } ? P : never;

export type BodyOf<E> = PartsOf<E> extends { body: infer T } ? T : never;
export type QueryOf<E> = PartsOf<E> extends { query: infer T } ? T : never;
export type ParamsOf<E> = PartsOf<E> extends { params: infer T } ? T : never;
export type HeadersOf<E> = PartsOf<E> extends { headers: infer T } ? T : never;

export type InputOf<E> = E extends { toInput: (parts: never) => infer I } ? I : never;
export type OutputOf<E> = E extends { toResponse: (output: infer O) => unknown } ? O : never;
