import { randomUUID } from 'node:crypto';

import type { ContextStore } from '@sklv-labs/nestjs-core/context';
import { defineContext, uuidField } from '@sklv-labs/nestjs-core/context';

/**
 * Every field this service carries through a unit of work.
 *
 * The declaration is the single source for the store type, inbound extraction on every transport,
 * outbound propagation, the log bindings and the documented request headers. Adding a field is one
 * edit here — not four, which is what it cost when the correlation id's name was written at the
 * adapter, in the context, in the header contract and in the response-header allowlist.
 *
 * `trust` is the setting to think about. `edge` means any caller may send it, which is fine for a
 * correlation id — forging one costs an attacker nothing. Anything that decides what data a
 * request may see (a tenant, an actor) is `internal` or `never`, so a header from the public
 * internet cannot assert it.
 */
export const appContext = defineContext({
  requestId: uuidField({
    id: true,
    carrier: 'x-request-id',
    trust: 'edge',
    generate: randomUUID,
    echo: true,
    // Fastify's own field name, so the framework's access lines and ours are one queryable field.
    log: 'reqId',
    writable: 'setup',
    description: 'Correlation id (UUID). Generated when absent or not a UUID.',
    example: '3f8a1c2e-5b7d-4e9f-9a1b-2c3d4e5f6a7b',
  }),
});

export type AppStore = ContextStore<typeof appContext>;
