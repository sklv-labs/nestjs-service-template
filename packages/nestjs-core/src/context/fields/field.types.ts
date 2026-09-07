import type { z } from 'zod';

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
