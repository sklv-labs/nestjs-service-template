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
