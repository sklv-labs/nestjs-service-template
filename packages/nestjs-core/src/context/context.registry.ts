import type { CarrierReader } from './carriers';
import type {
  AnyContextField,
  ContextFields,
  ContextRegistry,
  ExtractOptions,
  StoreOf,
  Trust,
} from './context.types';

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** `internal` trust accepts everything an `edge` does, plus fields reserved for peers. */
const accepts = (field: AnyContextField, trust: Trust): boolean =>
  field.carrier !== undefined &&
  field.trust !== 'never' &&
  (field.trust === 'edge' || trust === 'internal');

/**
 * Turns a field declaration into the machinery around it.
 *
 * One declaration is the single source for the store type, inbound extraction on every transport,
 * outbound propagation, log bindings and the documented header contract. Adding a field is one
 * edit; before this, the correlation id's name was written in four places and its validation in
 * two, one of which was unreachable.
 */
export const defineContext = <const F extends ContextFields>(fields: F): ContextRegistry<F> => {
  const entries = Object.entries(fields) as [keyof F & string, AnyContextField][];

  const ids = entries.filter(([, field]) => field.id);

  if (ids.length > 1) {
    throw new Error(
      `A context has at most one id field; found ${ids.map(([key]) => key).join(', ')}`,
    );
  }

  const idKey = ids[0]?.[0];

  const logKeys = Object.fromEntries(
    entries
      .filter(([, field]) => field.log !== false)
      .map(([key, field]) => [key, typeof field.log === 'string' ? field.log : key]),
  );

  const value = (
    key: string,
    field: AnyContextField,
    reader: CarrierReader,
    options: ExtractOptions<F>,
  ): unknown => {
    const override = (options.overrides as Record<string, unknown> | undefined)?.[key];

    if (override !== undefined) {
      return override;
    }

    if (accepts(field, options.trust ?? 'edge')) {
      const raw = first(reader.get(field.carrier as string));

      if (raw !== undefined) {
        const parsed = field.schema.safeParse(raw);

        if (parsed.success) {
          return parsed.data;
        }

        // Silence here means a misconfigured caller looks like an absent header forever.
        options.onRejected?.(key, raw);
      }
    }

    return field.generate?.();
  };

  return {
    fields,
    idKey,
    carrierNames: entries
      .map(([, field]) => field.carrier)
      .filter((name): name is string => name !== undefined),
    echoNames: entries
      .filter(([, field]) => field.echo && field.carrier !== undefined)
      .map(([, field]) => field.carrier as string),
    logKeys,

    extract: (reader, options = {}) =>
      Object.fromEntries(
        entries
          .map(([key, field]) => [key, value(key, field, reader, options)] as const)
          .filter(([, resolved]) => resolved !== undefined),
      ) as StoreOf<F>,

    extractId: (reader, options = {}) => {
      if (idKey === undefined) {
        return undefined;
      }

      const field = fields[idKey] as AnyContextField;
      const resolved = value(idKey, field, reader, options);

      return resolved === undefined ? undefined : field.serialize(resolved);
    },

    bindings: (store) =>
      Object.fromEntries(
        entries
          .filter(([key]) => logKeys[key] !== undefined)
          .map(([key]) => [logKeys[key], (store as Record<string, unknown>)[key]] as const)
          .filter(([, resolved]) => resolved !== undefined),
      ),

    headers: (store) =>
      Object.fromEntries(
        entries
          .filter(([, field]) => field.propagate && field.carrier !== undefined)
          .map(([key, field]) => {
            const resolved = (store as Record<string, unknown>)[key];

            return resolved === undefined
              ? undefined
              : ([field.carrier as string, field.serialize(resolved)] as const);
          })
          .filter((entry): entry is readonly [string, string] => entry !== undefined),
      ),

    inject: (store, writer) => {
      for (const [key, field] of entries) {
        if (!field.propagate || field.carrier === undefined) {
          continue;
        }

        const resolved = (store as Record<string, unknown>)[key];

        if (resolved !== undefined) {
          writer.set(field.carrier, field.serialize(resolved));
        }
      }
    },
  };
};
