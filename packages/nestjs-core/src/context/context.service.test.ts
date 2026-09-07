import { describe, expect, it } from 'vitest';

import { defineContext } from './context.registry';
import { stringField, uuidField } from './fields';
import { inactiveContext, runWithContext } from './testing';

const ID = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-8888-4777-8666-555544443333';

const registry = defineContext({
  requestId: uuidField({
    id: true,
    carrier: 'x-request-id',
    trust: 'edge',
    generate: () => ID,
    log: 'reqId',
    writable: 'setup',
  }),
  tenantId: uuidField({ carrier: 'x-tenant-id', trust: 'internal', writable: 'once' }),
  step: stringField({ trust: 'never', writable: 'always' }),
});

/**
 * `runWithContext` builds the store exactly as the module's middleware does, so these tests cannot
 * pass by assembling a context production would never produce.
 */
const enter = <T>(run: Parameters<typeof runWithContext<typeof registry.fields, T>>[2]): T =>
  runWithContext(registry, { requestId: ID }, run);

describe('outside a unit of work', () => {
  it('reports inactive and returns nothing, rather than throwing', () => {
    const context = inactiveContext(registry);

    expect(context.active).toBe(false);
    // `cls.getId()` throws when no context is active, and boot code has none.
    expect(context.id).toBeUndefined();
    expect(context.store).toBeUndefined();
    expect(context.bindings()).toBeUndefined();
    expect(context.headers()).toEqual({});
  });

  it('ignores a write instead of failing a startup task', () => {
    const context = inactiveContext(registry);

    expect(() => context.set('tenantId', ID)).not.toThrow();
  });

  it('works with no declaration wired at all', () => {
    const context = inactiveContext();

    expect(context.active).toBe(false);
    expect(context.id).toBeUndefined();
  });
});

describe('inside a unit of work', () => {
  it('exposes the id and the typed store', () => {
    enter((context) => {
      expect(context.active).toBe(true);
      expect(context.id).toBe(ID);
      expect(context.store?.requestId).toBe(ID);
    });
  });

  it('returns the bindings computed when the context was created', () => {
    enter((context) => {
      expect(context.bindings()).toEqual({ reqId: ID });
    });
  });

  it('propagates the declared fields outward', () => {
    enter((context) => {
      expect(context.headers()).toEqual({ 'x-request-id': ID });
    });
  });
});

describe('writability', () => {
  it('refuses to rewrite a field fixed at setup', () => {
    enter((context) => {
      // A correlation id that changes mid-request makes every line before it unfindable.
      expect(() => context.set('requestId', OTHER)).toThrow(/fixed when the context is created/);
      expect(context.store?.requestId).toBe(ID);
    });
  });

  it('allows a write-once field exactly once', () => {
    enter((context) => {
      context.set('tenantId', ID);

      expect(context.store?.tenantId).toBe(ID);
      // A rewritten tenant is a security bug, not something to tolerate.
      expect(() => context.set('tenantId', OTHER)).toThrow(/may only be written once/);
    });
  });

  it('allows a field declared always-writable to change', () => {
    enter((context) => {
      context.set('step', 'first');
      context.set('step', 'second');

      expect(context.store?.step).toBe('second');
    });
  });

  it('reflects a late write in the log bindings', () => {
    const logged = defineContext({
      requestId: uuidField({ id: true, generate: () => ID, log: 'reqId', writable: 'setup' }),
      tenantId: uuidField({ carrier: 'x-tenant-id', trust: 'internal', log: true }),
    });

    runWithContext(logged, {}, (context) => {
      expect(context.bindings()).toEqual({ reqId: ID });

      // A guard resolving the tenant mid-request must not leave the logger behind.
      context.set('tenantId', OTHER);

      expect(context.bindings()).toEqual({ reqId: ID, tenantId: OTHER });
    });
  });
});
