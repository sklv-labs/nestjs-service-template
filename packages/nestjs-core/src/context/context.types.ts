import type { CarrierReader, CarrierWriter } from './carriers';
import type { ContextField } from './fields';

/**
 * A field of an unknown value type.
 *
 * `any` is deliberate and confined to this alias: `ContextField` is contravariant in its value
 * through `serialize` and `generate`, so `unknown` would reject every concrete field and `never`
 * every schema. This is the standard variance escape hatch for a heterogeneous record.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- variance: see above
export type AnyContextField = ContextField<any>;

export type ContextFields = Record<string, AnyContextField>;

/** How much a transport is trusted. An internet-facing server is `edge`; a peer service is `internal`. */
export type Trust = 'edge' | 'internal';

type ValueOf<F> = F extends ContextField<infer T> ? T : never;

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
