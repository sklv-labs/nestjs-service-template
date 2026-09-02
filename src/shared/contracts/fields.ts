import type { Uuid } from '@sklv-labs/core';
import { z } from 'zod';

/**
 * Field builders for contracts. The description is the first argument, because a field's purpose
 * is the thing a reader wants first and an options object around it just adds punctuation.
 */

const describe = <T extends z.ZodType>(schema: T, text?: string): T =>
  text ? schema.describe(text) : schema;

/**
 * A UUID v7 whose inferred type is a branded id from `@sklv-labs/core`.
 *
 * The brand is a cast, not a `.transform()`: zod cannot express a transform in JSON Schema, so a
 * transformed schema throws when Nest renders the output side of OpenAPI.
 */
export const id = <T extends Uuid>(text?: string) =>
  describe(z.uuid({ version: 'v7' }) as unknown as z.ZodType<T, string>, text);

export const email = (text?: string) => describe(z.email(), text);

export const str = (text?: string, opts: { min?: number; max?: number } = {}) => {
  let s = z.string();
  if (opts.min !== undefined) s = s.min(opts.min);
  if (opts.max !== undefined) s = s.max(opts.max);
  return describe(s, text);
};

/** Coerced, because query strings and headers arrive as text. */
export const int = (text?: string, opts: { min?: number; max?: number } = {}) => {
  let n = z.coerce.number().int();
  if (opts.min !== undefined) n = n.min(opts.min);
  if (opts.max !== undefined) n = n.max(opts.max);
  return describe(n, text);
};

/** Accepts `true` / `false` / `1` / `0` as text, which is how flags arrive over HTTP. */
export const bool = (text?: string) => describe(z.stringbool(), text);

/** ISO-8601 string. Never `z.date()` — that has no JSON Schema representation. */
export const isoDate = (text?: string) => describe(z.iso.datetime(), text);

export const oneOf = <T extends readonly [string, ...string[]]>(values: T, text?: string) =>
  describe(z.enum(values), text);
