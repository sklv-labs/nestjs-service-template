import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  businessError,
  declaredBusinessErrors,
  isDomainError,
  reasonsOf,
  resetDeclaredErrors,
} from './domain-error';

beforeEach(() => {
  resetDeclaredErrors();
});

const orderNotFound = () =>
  businessError({
    code: 'ORDER_NOT_FOUND',
    details: z.object({ id: z.string() }),
    reasons: { BY_ID: 'No order exists with that id', BY_REFERENCE: 'No order has that reference' },
  });

describe('declaring a business error', () => {
  it('refuses a code that is already declared', () => {
    orderNotFound();

    // A duplicate is not a style problem: the code names the OpenAPI component and keys the
    // status map, so the second declaration silently wins in both.
    expect(orderNotFound).toThrow(/"ORDER_NOT_FOUND" is already declared/);
  });

  it('registers the code for the boot-time scan', () => {
    orderNotFound();

    expect(declaredBusinessErrors()).toEqual(['ORDER_NOT_FOUND']);
  });

  it('exposes its reasons, which is what the HTTP layer documents', () => {
    expect(reasonsOf(orderNotFound())).toEqual(['BY_ID', 'BY_REFERENCE']);
  });
});

describe('raising one', () => {
  it('takes the message from the reason, so the wording cannot drift per call site', () => {
    const error = orderNotFound().raise('BY_REFERENCE', { id: 'ord_1' });

    expect(error.message).toBe('No order has that reference');
    expect(error.code).toBe('ORDER_NOT_FOUND');
    expect(error.reason).toBe('BY_REFERENCE');
    expect(error.details).toEqual({ id: 'ord_1' });
  });

  it('returns the error rather than throwing, so `throw` still narrows control flow', () => {
    expect(isDomainError(orderNotFound().raise('BY_ID', { id: 'ord_1' }))).toBe(true);
  });
});
