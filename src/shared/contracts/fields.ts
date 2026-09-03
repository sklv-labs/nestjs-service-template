import type { Uuid } from '@sklv-labs/core';
import { z } from 'zod';

/**
 * Field builders for contracts. The description is the first argument, because a field's purpose is
 * the thing a reader wants first and an options object around it just adds punctuation.
 *
 * `example` belongs here rather than on the endpoint. Zod emits it into the JSON Schema, so
 * OpenAPI composes the request and response examples from the fields themselves — one definition,
 * next to the type and constraints it has to agree with. A separate example object next to the
 * schema is a second copy waiting to drift.
 */

type Common = { example?: unknown };

const finish = <T extends z.ZodType>(schema: T, text?: string, opts: Common = {}): T => {
  const described = text ? schema.describe(text) : schema;

  return (opts.example === undefined ? described : described.meta({ example: opts.example })) as T;
};

/**
 * A UUID v7 whose inferred type is a branded id from `@sklv-labs/core`.
 *
 * The brand is a cast, not a `.transform()`: zod cannot express a transform in JSON Schema, so a
 * transformed schema throws when Nest renders the output side of OpenAPI.
 */
export const id = <T extends Uuid>(text?: string, opts: Common = {}) =>
  finish(z.uuid({ version: 'v7' }) as unknown as z.ZodType<T, string>, text, opts);

export const email = (text?: string, opts: Common = {}) => finish(z.email(), text, opts);

export const str = (text?: string, opts: Common & { min?: number; max?: number } = {}) => {
  let s = z.string();
  if (opts.min !== undefined) s = s.min(opts.min);
  if (opts.max !== undefined) s = s.max(opts.max);
  return finish(s, text, opts);
};

/** Coerced, because query strings and headers arrive as text. */
export const int = (text?: string, opts: Common & { min?: number; max?: number } = {}) => {
  let n = z.coerce.number().int();
  if (opts.min !== undefined) n = n.min(opts.min);
  if (opts.max !== undefined) n = n.max(opts.max);
  return finish(n, text, opts);
};

/** Accepts `true` / `false` / `1` / `0` as text, which is how flags arrive over HTTP. */
export const bool = (text?: string, opts: Common = {}) => finish(z.stringbool(), text, opts);

/** ISO-8601 string. Never `z.date()` — that has no JSON Schema representation. */
export const isoDate = (text?: string, opts: Common = {}) => finish(z.iso.datetime(), text, opts);

export const oneOf = <T extends readonly [string, ...string[]]>(
  values: T,
  text?: string,
  opts: Common = {},
) => finish(z.enum(values), text, opts);
