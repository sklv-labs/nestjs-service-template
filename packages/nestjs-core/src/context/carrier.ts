/**
 * The one thing a transport has to provide.
 *
 * Every transport that can carry context reduces to a string map: HTTP headers, AMQP
 * `properties.headers`, a reserved key in a BullMQ job's data, a WebSocket envelope. Extraction and
 * propagation are written once against these two interfaces, so a new transport is a carrier rather
 * than another copy of the parse-validate-generate logic.
 *
 * Deliberately the same shape as OpenTelemetry's `TextMapPropagator`, so `traceparent` can be
 * handled by OTel's own propagator over the same carrier instead of reimplementing W3C parsing.
 */
export type CarrierReader = {
  get: (name: string) => string | string[] | undefined;
};

export type CarrierWriter = {
  set: (name: string, value: string) => void;
};

const EMPTY: CarrierReader = { get: () => undefined };

/**
 * Reads a plain object as a carrier.
 *
 * Names are matched case-insensitively. Node lowercases HTTP header names, but AMQP headers arrive
 * exactly as the publisher wrote them, and a field declared `x-tenant-id` must still be found when
 * a sender used `X-Tenant-Id`.
 */
export const carrierReader = (source: unknown): CarrierReader => {
  if (typeof source !== 'object' || source === null) {
    return EMPTY;
  }

  const bag = source as Record<string, string | string[] | undefined>;

  return {
    get: (name) => {
      const direct = bag[name];

      if (direct !== undefined) {
        return direct;
      }

      const wanted = name.toLowerCase();
      const match = Object.keys(bag).find((key) => key.toLowerCase() === wanted);

      return match === undefined ? undefined : bag[match];
    },
  };
};

/** Writes into a plain object — outbound headers, message properties, job data. */
export const carrierWriter = (target: Record<string, string>): CarrierWriter => ({
  set: (name, value) => {
    target[name] = value;
  },
});

/** The carrier of an inbound HTTP request or an AMQP message: whatever it calls `headers`. */
export const headersCarrier = (source: unknown): CarrierReader =>
  carrierReader((source as { headers?: unknown } | undefined)?.headers);
