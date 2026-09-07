import { randomUUID } from 'node:crypto';

export type CorrelationOptions = {
  /** Header carrying an inbound correlation id. */
  header?: string;
  /**
   * Whether an inbound value may be adopted. The default accepts UUIDs only.
   *
   * This is a security boundary, not a formality: the header is caller-controlled, and whatever it
   * holds is stamped on every log line for the request. An unchecked value is a way to put
   * newlines, control characters or kilobytes into log storage — and to forge another request's id.
   */
  accept?: (value: string) => boolean;
  /** Generates an id when there is no acceptable inbound one. */
  generate?: () => string;
};

export type Correlation = {
  readonly header: string;
  /** The id for an inbound request: an acceptable inbound value, otherwise a fresh one. */
  readonly fromRequest: (req: unknown) => string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type HeaderBag = Record<string, string | string[] | undefined>;

const readHeader = (req: unknown, header: string): string | undefined => {
  const value = (req as { headers?: HeaderBag } | undefined)?.headers?.[header];

  return Array.isArray(value) ? value[0] : value;
};

/**
 * The correlation id policy: which header carries it, which inbound values are trusted, and how one
 * is minted otherwise.
 *
 * It lives here, next to the context that carries the id for the rest of the request, so there is
 * one implementation. It used to exist twice — once at the Fastify adapter with validation, once in
 * this module's `idGenerator` without — and only the adapter's copy was reachable.
 */
export const createCorrelation = (options: CorrelationOptions = {}): Correlation => {
  const header = options.header ?? DEFAULT_CORRELATION_HEADER;
  const accept = options.accept ?? ((value: string) => UUID.test(value));
  const generate = options.generate ?? randomUUID;

  return {
    header,
    fromRequest: (req) => {
      const inbound = readHeader(req, header);

      return inbound && accept(inbound) ? inbound : generate();
    },
  };
};

export const DEFAULT_CORRELATION_HEADER = 'x-request-id';

/** The default policy. Shared by the HTTP edge and the context, so both agree by construction. */
export const correlation = createCorrelation();

/**
 * The Fastify adapter options that hand id creation to a correlation policy.
 *
 * `requestIdHeader` is switched off deliberately: Fastify's own header extraction adopts any
 * inbound string, so the policy above would never get to reject anything. The result becomes
 * `req.id`, which is what the context then adopts — one id across the framework's lines and ours.
 *
 * Shaped structurally rather than typed against Fastify, keeping this module transport-neutral.
 */
export const fastifyCorrelationOptions = (
  policy: Correlation = correlation,
): {
  requestIdHeader: false;
  genReqId: (req: unknown) => string;
} => ({
  requestIdHeader: false,
  genReqId: policy.fromRequest,
});
