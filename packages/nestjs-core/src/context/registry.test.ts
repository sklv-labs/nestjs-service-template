import { describe, expect, it, vi } from 'vitest';

import { carrierReader, carrierWriter } from './carrier';
import { contextField, stringField, uuidField } from './field';
import { defineContext } from './registry';
import { z } from 'zod';

const ID = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-8888-4777-8666-555544443333';

/**
 * A declaration with one field of each trust level, which is what most of these tests need: the
 * interesting behaviour is in the interaction between a field's declaration and the trust level of
 * the transport it arrived on.
 */
const registry = defineContext({
  requestId: uuidField({
    id: true,
    carrier: 'x-request-id',
    trust: 'edge',
    generate: () => 'generated',
    echo: true,
    log: 'reqId',
    writable: 'setup',
  }),
  tenantId: uuidField({ carrier: 'x-tenant-id', trust: 'internal' }),
  actorId: uuidField({ trust: 'never', log: true }),
  locale: stringField({ carrier: 'accept-language', trust: 'edge', log: false }),
});

describe('inbound extraction', () => {
  it('adopts a value that satisfies the field contract', () => {
    const store = registry.extract(carrierReader({ 'x-request-id': ID }));

    expect(store.requestId).toBe(ID);
  });

  it('replaces a value that fails the contract, rather than rejecting the request', () => {
    const onRejected = vi.fn();
    const store = registry.extract(carrierReader({ 'x-request-id': 'not-a-uuid' }), { onRejected });

    expect(store.requestId).toBe('generated');
    // Silence would make a misconfigured caller indistinguishable from an absent header.
    expect(onRejected).toHaveBeenCalledWith('requestId', 'not-a-uuid');
  });

  it('generates when the header is absent', () => {
    expect(registry.extract(carrierReader({})).requestId).toBe('generated');
  });

  it('leaves a field with no generator unset', () => {
    expect(registry.extract(carrierReader({})).tenantId).toBeUndefined();
  });

  it('prefers an override, so a transport that already decided the id keeps it', () => {
    const store = registry.extract(carrierReader({ 'x-request-id': ID }), {
      overrides: { requestId: OTHER },
    });

    expect(store.requestId).toBe(OTHER);
  });

  it('takes the first value when a header arrives more than once', () => {
    const store = registry.extract(carrierReader({ 'x-request-id': [ID, OTHER] }));

    expect(store.requestId).toBe(ID);
  });

  it('matches carrier names case-insensitively, for transports that do not normalise', () => {
    const store = registry.extract(carrierReader({ 'X-Request-Id': ID }));

    expect(store.requestId).toBe(ID);
  });
});

describe('trust boundaries', () => {
  it('ignores an internal-only field at the edge', () => {
    const store = registry.extract(carrierReader({ 'x-tenant-id': ID }), { trust: 'edge' });

    // The whole point: a tenant asserted by an internet-facing header is a cross-tenant read.
    expect(store.tenantId).toBeUndefined();
  });

  it('honours an internal-only field from a trusted peer', () => {
    const store = registry.extract(carrierReader({ 'x-tenant-id': ID }), { trust: 'internal' });

    expect(store.tenantId).toBe(ID);
  });

  it('honours an edge field at either trust level', () => {
    for (const trust of ['edge', 'internal'] as const) {
      expect(registry.extract(carrierReader({ 'x-request-id': ID }), { trust }).requestId).toBe(ID);
    }
  });

  it('never takes a `never` field from a carrier, even from a peer', () => {
    const store = registry.extract(carrierReader({ actorId: ID, 'x-actor-id': ID }), {
      trust: 'internal',
    });

    expect(store.actorId).toBeUndefined();
  });
});

describe('log bindings', () => {
  it('renames to the declared log key and drops opted-out fields', () => {
    const store = registry.extract(carrierReader({ 'x-request-id': ID, 'accept-language': 'en' }));

    expect(registry.bindings(store)).toEqual({ reqId: ID });
  });

  it('omits fields with no value rather than emitting undefined', () => {
    expect(registry.bindings({ requestId: ID })).toEqual({ reqId: ID });
  });
});

describe('outbound propagation', () => {
  it('carries fields that declare a carrier and drops the rest', () => {
    const headers = registry.headers({ requestId: ID, tenantId: OTHER, actorId: ID });

    expect(headers).toEqual({ 'x-request-id': ID, 'x-tenant-id': OTHER });
  });

  it('writes into any carrier', () => {
    const target: Record<string, string> = {};
    registry.inject({ requestId: ID }, carrierWriter(target));

    expect(target).toEqual({ 'x-request-id': ID });
  });

  it('serialises through the field, not String()', () => {
    const stamped = defineContext({
      at: contextField(z.coerce.date(), {
        carrier: 'x-at',
        trust: 'edge',
        serialize: (value: Date) => value.toISOString(),
      }),
    });

    expect(stamped.headers({ at: new Date('2026-01-01T00:00:00.000Z') })).toEqual({
      'x-at': '2026-01-01T00:00:00.000Z',
    });
  });

  it('excludes a field that declares a carrier but opts out of propagation', () => {
    const local = defineContext({
      hop: uuidField({ carrier: 'x-hop', trust: 'edge', propagate: false }),
    });

    expect(local.headers({ hop: ID })).toEqual({});
  });
});

describe('the declaration itself', () => {
  it('exposes the carrier names, so nothing else has to hardcode them', () => {
    expect(registry.carrierNames).toEqual(['x-request-id', 'x-tenant-id', 'accept-language']);
    expect(registry.echoNames).toEqual(['x-request-id']);
  });

  it('names the id field', () => {
    expect(registry.idKey).toBe('requestId');
  });

  it('extracts just the id, for a transport deciding it before the context exists', () => {
    expect(registry.extractId(carrierReader({ 'x-request-id': ID }))).toBe(ID);
  });

  it('has no id to extract when no field claims it', () => {
    const anonymous = defineContext({ locale: stringField({ carrier: 'accept-language' }) });

    expect(anonymous.idKey).toBeUndefined();
    expect(anonymous.extractId(carrierReader({}))).toBeUndefined();
  });

  it('refuses two id fields, which would make `getId()` ambiguous', () => {
    expect(() =>
      defineContext({
        a: uuidField({ id: true, carrier: 'a' }),
        b: uuidField({ id: true, carrier: 'b' }),
      }),
    ).toThrow(/at most one id field/);
  });

  it('defaults a field to internal trust, so nothing is edge-readable by accident', () => {
    const careless = defineContext({ secretish: stringField({ carrier: 'x-secretish' }) });

    expect(careless.extract(carrierReader({ 'x-secretish': 'v' }), { trust: 'edge' })).toEqual({});
    expect(careless.extract(carrierReader({ 'x-secretish': 'v' }), { trust: 'internal' })).toEqual({
      secretish: 'v',
    });
  });
});
