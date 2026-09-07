import type { CarrierReader, CarrierWriter } from './carrier.types';

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
