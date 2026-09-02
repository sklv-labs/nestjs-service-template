import { applyDecorators, Body, Param, Query } from '@nestjs/common';
import { ApiBody, ApiHeaders, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { z } from 'zod';

import type { BusinessError } from '../errors';

import { businessErrorResponse, errorResponse, mapErrorStatus } from './error-response';
import { openApiSchema } from './openapi';
import { RequestHeaders } from './request';

export type Examples = Record<string, { summary: string; value: unknown }>;

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
  bodyExamples?: Examples;
};

/**
 * The parsed request, with only the parts the endpoint actually declares. An endpoint with no
 * `query` gets no `query` key, so `toInput` cannot reach for something that was never validated.
 */
export type RequestParts<R extends RequestSpec> = (R['headers'] extends z.ZodType
  ? { headers: z.infer<R['headers']> }
  : object) &
  (R['params'] extends z.ZodType ? { params: z.infer<R['params']> } : object) &
  (R['query'] extends z.ZodType ? { query: z.infer<R['query']> } : object) &
  (R['body'] extends z.ZodType ? { body: z.infer<R['body']> } : object);

export type Endpoint<R extends RequestSpec = RequestSpec, Input = unknown, Output = unknown> = {
  summary: string;
  description?: string;
  request: R;
  responses: ResponseSpec[];
  /**
   * Translates a validated HTTP request into the operation's input. This is the seam that keeps
   * handlers transport-agnostic: an RMQ consumer for the same operation writes its own version of
   * this and the handler is untouched.
   */
  toInput: (parts: RequestParts<R>) => Input;
  /** Translates the operation's output into the response contract. */
  toResponse: (output: Output) => unknown;
};

/**
 * The shape the decorators need. Deliberately drops the two function members: a specific endpoint
 * is not assignable to `Endpoint<RequestSpec, unknown, unknown>` because function parameters are
 * contravariant, and the decorators do not use them anyway.
 */
export type DocumentedEndpoint = {
  summary: string;
  description?: string;
  request: RequestSpec;
  responses: ResponseSpec[];
};

/**
 * Describes one endpoint in one place: what a request may carry, how it maps onto an operation,
 * and every response it can produce. Decorators, parameter schemas, handler types and the OpenAPI
 * document all derive from this single value.
 */
export const endpoint = <const R extends RequestSpec, Input, Output>(
  def: Endpoint<R, Input, Output>,
): Endpoint<R, Input, Output> => def;

/** A success response. */
export const success = (
  status: number,
  description: string,
  schema: z.ZodType,
  examples?: Examples,
): ResponseSpec => ({ status, description, schema, examples });

/** A transport-level failure with no business meaning — validation, auth, a missing route. */
export const failure = (status: number, description: string): ResponseSpec => ({
  status,
  description,
  schema: errorResponse,
});

/**
 * A business error response. Declaring it here is also what maps the code to this status at
 * runtime, so the documented status and the one the filter returns are the same by construction.
 */
export const httpError = <
  Code extends string,
  Reasons extends readonly [string, ...string[]],
  Details extends z.ZodType,
>(
  status: number,
  error: BusinessError<Code, Reasons, Details>,
  description: string,
  examples?: Examples,
): ResponseSpec => {
  mapErrorStatus(error.code, status);

  return { status, description, schema: businessErrorResponse(status, error), examples };
};

/**
 * `.optional()` wraps a schema, so a description set before it sits on the inner type. Read
 * through one level of wrapping so documented headers keep their description.
 */
const descriptionOf = (field: z.ZodType): string | undefined =>
  field.description ??
  (field as unknown as { def?: { innerType?: { description?: string } } }).def?.innerType
    ?.description;

/** Applies an endpoint's documentation. Replaces a stack of six `@Api*` decorators. */
export const ApiEndpoint = (e: DocumentedEndpoint) => {
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
        ...(e.request.bodyExamples ? { examples: e.request.bodyExamples } : {}),
      }),
    );
  }

  if (e.request.headers) {
    const shape = e.request.headers.shape;
    decorators.push(
      ApiHeaders(
        Object.entries(shape).map(([name, field]) => ({
          name,
          description: descriptionOf(field),
          required: !field.safeParse(undefined).success,
        })),
      ),
    );
  }

  return applyDecorators(...decorators);
};

/* Parameter decorators that read their schema from the endpoint, so a handler never repeats it. */
export const ReqBody = (e: DocumentedEndpoint) => Body({ schema: e.request.body });
export const ReqQuery = (e: DocumentedEndpoint) => Query({ schema: e.request.query });
export const ReqParams = (e: DocumentedEndpoint) => Param({ schema: e.request.params });
export const ReqHeaders = (e: DocumentedEndpoint) => RequestHeaders({ schema: e.request.headers });

/* Handler parameter types, derived from the same descriptor. */
type Part<R extends RequestSpec, K extends keyof RequestSpec> = R[K] extends z.ZodType
  ? z.infer<R[K]>
  : never;

export type BodyOf<E> = E extends Endpoint<infer R, never, never> ? Part<R, 'body'> : never;
export type QueryOf<E> = E extends Endpoint<infer R, never, never> ? Part<R, 'query'> : never;
export type ParamsOf<E> = E extends Endpoint<infer R, never, never> ? Part<R, 'params'> : never;
export type HeadersOf<E> = E extends Endpoint<infer R, never, never> ? Part<R, 'headers'> : never;

/** The operation input an endpoint produces, and the output it consumes. */
export type InputOf<E> = E extends Endpoint<RequestSpec, infer I, never> ? I : never;
export type OutputOf<E> = E extends Endpoint<RequestSpec, never, infer O> ? O : never;
