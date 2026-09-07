import type { z } from 'zod';

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
