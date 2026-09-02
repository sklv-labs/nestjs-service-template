import { applyDecorators, Body, Param, Query } from '@nestjs/common';
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

export type RequestShape = {
  headers?: z.ZodObject;
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodObject;
};

/**
 * The parsed request, carrying only the parts the endpoint declared. An endpoint with no `.query()`
 * has no `query` key, so `toInput` cannot reach for something that was never validated.
 */
export type RequestParts<R extends RequestShape> = (R['headers'] extends z.ZodObject
  ? { headers: z.infer<R['headers']> }
  : object) &
  (R['params'] extends z.ZodObject ? { params: z.infer<R['params']> } : object) &
  (R['query'] extends z.ZodObject ? { query: z.infer<R['query']> } : object) &
  (R['body'] extends z.ZodObject ? { body: z.infer<R['body']> } : object);

/** What the decorators read. Drops the mapping functions, which they do not use. */
export type DocumentedEndpoint = {
  readonly summary: string;
  readonly description?: string;
  readonly request: RequestShape;
  readonly responses: readonly ResponseSpec[];
  readonly bodyExamples?: Examples;
};

/**
 * Builds an endpoint description: what the request may carry, how it maps onto an operation, and
 * every response it can produce.
 *
 * The order is enforced by the types rather than by convention — `.input()` sees only the request
 * parts declared before it, so calling it first is a compile error rather than a silent `unknown`.
 */
class EndpointBuilder<R extends RequestShape, Input, Output> {
  readonly request: RequestShape = {};
  readonly responses: ResponseSpec[] = [];

  description?: string;
  private bodyExample?: unknown;
  private mapInput?: (parts: RequestParts<R>) => Input;
  private mapOutput?: (output: Output) => unknown;

  constructor(readonly summary: string) {}

  /** Longer prose for the operation. The summary is the one-liner. */
  about(description: string): this {
    this.description = description;
    return this;
  }

  headers<T extends z.ZodRawShape>(shape: T) {
    this.request.headers = z.object(shape);
    return this as unknown as EndpointBuilder<R & { headers: z.ZodObject<T> }, Input, Output>;
  }

  params<T extends z.ZodRawShape>(shape: T) {
    this.request.params = z.object(shape);
    return this as unknown as EndpointBuilder<R & { params: z.ZodObject<T> }, Input, Output>;
  }

  query<T extends z.ZodRawShape>(shape: T) {
    this.request.query = z.object(shape);
    return this as unknown as EndpointBuilder<R & { query: z.ZodObject<T> }, Input, Output>;
  }

  /** Strict: an unknown key is a 400 rather than a silently dropped field. */
  body<T extends z.ZodRawShape>(shape: T) {
    this.request.body = z.object(shape).strict();
    return this as unknown as EndpointBuilder<R & { body: z.ZodObject<T> }, Input, Output>;
  }

  /** A sample request payload, shown in the documentation. */
  example(value: unknown): this {
    this.bodyExample = value;
    return this;
  }

  /**
   * Translates a validated request into the operation's input. This is the seam that keeps handlers
   * transport-agnostic: an RMQ consumer for the same operation writes its own version of this and
   * the handler is untouched.
   */
  input<I>(map: (parts: RequestParts<R>) => I) {
    this.mapInput = map as unknown as (parts: RequestParts<R>) => Input;
    return this as unknown as EndpointBuilder<R, I, Output>;
  }

  /** Translates the operation's output into the response contract. */
  output<O>(map: (output: O) => unknown) {
    this.mapOutput = map as unknown as (output: Output) => unknown;
    return this as unknown as EndpointBuilder<R, Input, O>;
  }

  /** A success response. */
  ok(status: number, schema: z.ZodType, description: string, example?: unknown): this {
    this.responses.push({
      status,
      description,
      schema,
      ...(example === undefined
        ? {}
        : { examples: { default: { summary: description, value: example } } }),
    });
    return this;
  }

  /** A transport-level failure with no business meaning — validation, auth, a missing route. */
  fails(status: number, description: string): this {
    this.responses.push({ status, description, schema: errorResponse });
    return this;
  }

  /**
   * A business error response. Declaring it here also maps the code to this status at runtime, and
   * generates one example per reason from the messages on the error declaration.
   */
  error<D extends z.ZodType>(
    status: number,
    error: BusinessErrorShape<D>,
    detailsExample: z.input<D>,
    description?: string,
  ): this {
    mapErrorStatus(error.code, status);

    this.responses.push({
      status,
      description: description ?? error.code,
      schema: businessErrorResponse(status, error),
      examples: businessErrorExamples(status, error, detailsExample),
    });
    return this;
  }

  /* Consumed by the controller. */

  toInput(parts: RequestParts<R>): Input {
    if (!this.mapInput) {
      throw new Error(`Endpoint "${this.summary}" has no .input() mapping`);
    }
    return this.mapInput(parts);
  }

  toResponse(output: Output): unknown {
    if (!this.mapOutput) {
      throw new Error(`Endpoint "${this.summary}" has no .output() mapping`);
    }
    return this.mapOutput(output);
  }

  get bodyExamples(): Examples | undefined {
    return this.bodyExample === undefined
      ? undefined
      : { standard: { summary: 'Example request', value: this.bodyExample } };
  }
}

/**
 * Starts an endpoint description. Nothing else needs importing: the request parts, the responses
 * and the mappings are all methods, so a contract is one import and one expression.
 */
export const endpoint = (summary: string) => new EndpointBuilder<object, never, never>(summary);

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
        ...(e.bodyExamples ? { examples: e.bodyExamples } : {}),
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

  return applyDecorators(...decorators);
};

/* Parameter decorators, reading their schema from the endpoint so a handler never repeats it. */
export const ReqBody = (e: DocumentedEndpoint) => Body({ schema: e.request.body });
export const ReqQuery = (e: DocumentedEndpoint) => Query({ schema: e.request.query });
export const ReqParams = (e: DocumentedEndpoint) => Param({ schema: e.request.params });
export const ReqHeaders = (e: DocumentedEndpoint) => RequestHeaders({ schema: e.request.headers });

/**
 * Handler parameter types, inferred from the endpoint's own `toInput` signature. Reading them from
 * there rather than from the builder's type parameters avoids a variance problem: `Input` appears
 * in a return position, so a builder with a concrete input is not assignable to one with `never`.
 */
type PartsOf<E> = E extends { toInput: (parts: infer P) => unknown } ? P : never;

export type BodyOf<E> = PartsOf<E> extends { body: infer T } ? T : never;
export type QueryOf<E> = PartsOf<E> extends { query: infer T } ? T : never;
export type ParamsOf<E> = PartsOf<E> extends { params: infer T } ? T : never;
export type HeadersOf<E> = PartsOf<E> extends { headers: infer T } ? T : never;

/**
 * `.optional()` wraps a schema, so a description set before it sits on the inner type. Read through
 * one level of wrapping so documented headers keep their description.
 */
const descriptionOf = (field: z.ZodType): string | undefined =>
  field.description ??
  (field as unknown as { def?: { innerType?: { description?: string } } }).def?.innerType
    ?.description;
