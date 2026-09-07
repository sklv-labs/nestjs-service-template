import type { CarrierReader, ContextFields, ContextRegistry, Trust } from '../../context';
import { headersCarrier } from '../../context';

/**
 * The Fastify adapter options that hand id creation to a context declaration.
 *
 * The id cannot originate in the context: Fastify assigns `req.id` from `genReqId` before any Nest
 * middleware runs, and `req.id` is what Fastify's own machinery logs. So the transport mints it
 * from the declaration, and the context adopts it — one id across the framework's lines and ours.
 *
 * `requestIdHeader` is switched off deliberately. Fastify's own header extraction adopts any
 * inbound string, which would mean the field's contract never gets to reject anything.
 *
 * Typed structurally rather than against Fastify, keeping this free of the adapter's types.
 */
export const fastifyContextOptions = <F extends ContextFields>(
  registry: ContextRegistry<F>,
  options: {
    trust?: Trust;
    carrierOf?: (req: unknown) => CarrierReader;
    generate?: () => string;
  } = {},
): {
  requestIdHeader: false;
  genReqId: (req: unknown) => string;
} => {
  const carrierOf = options.carrierOf ?? headersCarrier;
  const trust = options.trust ?? 'edge';

  return {
    requestIdHeader: false,
    genReqId: (req) => registry.extractId(carrierOf(req), { trust }) ?? crypto.randomUUID(),
  };
};
