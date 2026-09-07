/** The declaration itself, provided so `Context` can apply a field's rules. */
export const CONTEXT_REGISTRY = Symbol('CONTEXT_REGISTRY');

/**
 * Store key for the precomputed log bindings.
 *
 * A symbol, so it cannot collide with a declared field, and so a field named `bindings` stays
 * possible.
 */
export const CONTEXT_BINDINGS = Symbol('CONTEXT_BINDINGS');
