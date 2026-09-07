import type { CarrierReader, CarrierWriter } from './carrier';
import type { ContextField } from './field';

/**
 * A field of an unknown value type.
 *
 * `any` is deliberate and confined to this alias: `ContextField` is contravariant in its value
 * through `serialize` and `generate`, so `unknown` would reject every concrete field and `never`
 * every schema. This is the standard variance escape hatch for a heterogeneous record.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- variance: see above
export type AnyContextField = ContextField<any, boolean>;

export type ContextFields = Record<string, AnyContextField>;

/** How much a transport is trusted. An internet-facing server is `edge`; a peer service is `internal`. */
export type Trust = 'edge' | 'internal';

type ValueOf<F> = F extends ContextField<infer T, boolean> ? T : never;

type RequiredKeys<F extends ContextFields> = {
  [K in keyof F]: F[K]['required'] extends true ? K : never;
}[keyof F];

/**
 * The store type, derived from the declaration rather than restated: a field with a generator
 * always has a value, and one without may not.
 */
export type StoreOf<F extends ContextFields> = {
  [K in RequiredKeys<F>]: ValueOf<F[K]>;
} & {
  [K in Exclude<keyof F, RequiredKeys<F>>]?: ValueOf<F[K]>;
};

/** The store type of a registry, so a service names its declaration and not its field map. */
export type ContextStore<R> = R extends ContextRegistry<infer F> ? StoreOf<F> : never;

export type ExtractOptions<F extends ContextFields> = {
  trust?: Trust;
  /** Values already decided elsewhere — the id a transport minted before the context existed. */
  overrides?: Partial<StoreOf<F>>;
  /** Called when an inbound value was present but failed its contract, and so was discarded. */
  onRejected?: (field: string, raw: string) => void;
};

export type ContextRegistry<F extends ContextFields = ContextFields> = {
  readonly fields: F;
  /** The field designated as the context id, if any. */
  readonly idKey: (keyof F & string) | undefined;
  /** Every wire name this service reads or writes — for response-header allowlists and docs. */
  readonly carrierNames: readonly string[];
  /** Wire names echoed back on responses. */
  readonly echoNames: readonly string[];
  /** The log key each field is written under, keyed by field name. */
  readonly logKeys: Readonly<Record<string, string>>;
  extract: (reader: CarrierReader, options?: ExtractOptions<F>) => StoreOf<F>;
  /** Just the id, for a transport that has to decide it before the context exists. */
  extractId: (reader: CarrierReader, options?: ExtractOptions<F>) => string | undefined;
  bindings: (store: Partial<StoreOf<F>>) => Record<string, unknown>;
  inject: (store: Partial<StoreOf<F>>, writer: CarrierWriter) => void;
  headers: (store: Partial<StoreOf<F>>) => Record<string, string>;
};

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

      const resolved = value(idKey, fields[idKey] as AnyContextField, reader, options);

      return resolved === undefined ? undefined : String(resolved);
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
          .map(
            ([key, field]) =>
              [field.carrier as string, (store as Record<string, unknown>)[key]] as const,
          )
          .filter(([, resolved]) => resolved !== undefined)
          .map(([name, resolved]) => [name, String(resolved)] as const),
      ),

    inject: (store, writer) => {
      for (const [key, field] of entries) {
        if (!field.propagate || field.carrier === undefined) {
          continue;
        }

        const resolved = (store as Record<string, unknown>)[key];

        if (resolved !== undefined) {
          writer.set(field.carrier, field.serialize(resolved as never));
        }
      }
    },
  };
};
