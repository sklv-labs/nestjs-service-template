import { z } from 'zod';

import type { ContextField, FieldOptions, IsRequired } from './field.types';

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
