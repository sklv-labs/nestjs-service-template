import { z } from 'zod';

/**
 * Where a field's inbound value may come from.
 *
 * - `edge` — any caller may send it. Correlation ids qualify: a forged one costs nothing.
 * - `internal` — only a trusted peer. This is the default, and it is the setting that matters:
 *   a tenant id honoured from the public internet is a cross-tenant read.
 * - `never` — no carrier may set it, only code. Anything resolved from a credential is this.
 */
export type FieldTrust = 'edge' | 'internal' | 'never';

/** When application code may write the field after the context exists. */
export type FieldWritable = 'setup' | 'once' | 'always';

export type FieldOptions<T> = {
  /** Wire name. Omit for a field that never travels. */
  carrier?: string;
  trust?: FieldTrust;
  /** Mints a value when there is no acceptable inbound one. Its presence makes the field required. */
  generate?: () => T;
  /** Send it on outbound calls. Defaults to true when a carrier is declared. */
  propagate?: boolean;
  /** Echo it back to the caller on the response. */
  echo?: boolean;
  /** Include in log lines; a string renames the log key. Defaults to the field's own name. */
  log?: boolean | string;
  writable?: FieldWritable;
  serialize?: (value: T) => string;
  /** Documentation, used for the generated request-header contract. */
  description?: string;
  example?: string;
  /**
   * Marks this as the context id — `cls.getId()`, and the value a transport is asked to agree with
   * (Fastify decides `req.id` before any framework code runs). At most one field.
   */
  id?: boolean;
};

export type ContextField<T = unknown, Required extends boolean = boolean> = {
  readonly schema: z.ZodType<T>;
  readonly carrier: string | undefined;
  readonly trust: FieldTrust;
  readonly generate: (() => T) | undefined;
  readonly propagate: boolean;
  readonly echo: boolean;
  readonly log: string | boolean;
  readonly writable: FieldWritable;
  readonly serialize: (value: T) => string;
  readonly description: string | undefined;
  readonly example: string | undefined;
  readonly id: boolean;
  /** True when a generator guarantees a value. Lifted into the type, hence the literal. */
  readonly required: Required;
};

/** A declared `generate` is what makes the field non-optional in the inferred store type. */
export type IsRequired<O> = 'generate' extends keyof O ? true : false;

const build = <T, O extends FieldOptions<T>>(
  schema: z.ZodType<T>,
  options: O,
): ContextField<T, IsRequired<O>> =>
  ({
    schema,
    carrier: options.carrier,
    // Conservative by default: a field is not honoured from the public edge unless it says so.
    trust: options.trust ?? 'internal',
    generate: options.generate,
    propagate: options.propagate ?? options.carrier !== undefined,
    echo: options.echo ?? false,
    // Resolved against the field's key by `defineContext`, which is what knows the key.
    log: options.log ?? true,
    writable: options.writable ?? 'once',
    serialize: options.serialize ?? ((value: T) => String(value)),
    description: options.description,
    example: options.example,
    id: options.id ?? false,
    required: (options.generate !== undefined) as IsRequired<O>,
  }) as const;

/**
 * A field whose wire value must be a UUID.
 *
 * Validation is not decoration. An inbound value ends up in the store, on every log line for the
 * unit of work, and on outbound calls — so an unchecked string is a way to put newlines or
 * kilobytes into log storage, and to impersonate another caller's identifiers.
 */
export const uuidField = <const O extends FieldOptions<string>>(
  options: O = {} as O,
): ContextField<string, IsRequired<O>> => build(z.uuid(), options);

export const stringField = <const O extends FieldOptions<string> & { max?: number }>(
  options: O = {} as O,
): ContextField<string, IsRequired<O>> => build(z.string().max(options.max ?? 256), options);

/** Any contract the caller wants, for fields neither of the above covers. */
export const contextField = <T, const O extends FieldOptions<T>>(
  schema: z.ZodType<T>,
  options: O = {} as O,
): ContextField<T, IsRequired<O>> => build(schema, options);
