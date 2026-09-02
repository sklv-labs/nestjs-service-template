import type { Uuid } from '@sklv-labs/core';
import { z } from 'zod';

/**
 * Field builders for transport contracts.
 *
 * These exist so a contract reads as a description of the field rather than as a chain of zod
 * calls, and so the awkward parts are decided once: coercion for anything arriving as text, the
 * cast that keeps branded ids representable in JSON Schema, and ISO strings instead of `Date`.
 */

type Described = { describe?: string };

const described = <T extends z.ZodType>(schema: T, describe?: string): T =>
  describe ? schema.describe(describe) : schema;

/**
 * A UUID v7 whose inferred type is a branded id from `@sklv-labs/core`.
 *
 * The brand is a cast, not a `.transform()`: zod cannot express a transform in JSON Schema, so a
 * transformed schema throws when Nest renders the *output* side of OpenAPI.
 */
export const id = <T extends Uuid>(opts: Described = {}) =>
  described(z.uuid({ version: 'v7' }) as unknown as z.ZodType<T, string>, opts.describe);

export const email = (opts: Described = {}) => described(z.email(), opts.describe);

export const str = (opts: Described & { min?: number; max?: number } = {}) => {
  let s = z.string();
  if (opts.min !== undefined) s = s.min(opts.min);
  if (opts.max !== undefined) s = s.max(opts.max);
  return described(s, opts.describe);
};

/** Coerced, because query strings and headers arrive as text. */
export const int = (opts: Described & { min?: number; max?: number } = {}) => {
  let n = z.coerce.number().int();
  if (opts.min !== undefined) n = n.min(opts.min);
  if (opts.max !== undefined) n = n.max(opts.max);
  return described(n, opts.describe);
};

/** Accepts `true`/`false`/`1`/`0` as text, which is how flags arrive over HTTP. */
export const bool = (opts: Described = {}) => described(z.stringbool(), opts.describe);

/** ISO-8601 string. Never `z.date()` — that has no JSON Schema representation. */
export const isoDate = (opts: Described = {}) => described(z.iso.datetime(), opts.describe);

export const oneOf = <T extends readonly [string, ...string[]]>(values: T, opts: Described = {}) =>
  described(z.enum(values), opts.describe);
