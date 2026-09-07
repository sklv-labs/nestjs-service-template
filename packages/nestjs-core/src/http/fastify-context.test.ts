import { describe, expect, it } from 'vitest';

import { carrierReader, defineContext, uuidField } from '../context';
import { fastifyContextOptions } from './fastify-context';

const ID = '11111111-2222-4333-8444-555555555555';

const registry = defineContext({
  requestId: uuidField({ id: true, carrier: 'x-request-id', trust: 'edge', generate: () => ID }),
});

describe('fastifyContextOptions', () => {
  it('takes over id creation from Fastify', () => {
    // Fastify's own extraction adopts any inbound string, which would mean the field's contract
    // never gets to reject anything.
    expect(fastifyContextOptions(registry).requestIdHeader).toBe(false);
  });

  it('applies the declaration to the inbound header', () => {
    const { genReqId } = fastifyContextOptions(registry);

    expect(genReqId({ headers: { 'x-request-id': ID } })).toBe(ID);
  });

  it('replaces a value the declaration rejects', () => {
    const { genReqId } = fastifyContextOptions(registry);

    expect(genReqId({ headers: { 'x-request-id': 'not-a-uuid' } })).toBe(ID);
  });

  it('honours a custom carrier lookup, for a transport that keeps them elsewhere', () => {
    const { genReqId } = fastifyContextOptions(registry, {
      carrierOf: (req) => carrierReader((req as { meta: unknown }).meta),
    });

    expect(genReqId({ meta: { 'x-request-id': ID } })).toBe(ID);
  });
});
