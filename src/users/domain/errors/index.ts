/**
 * Business errors this domain can raise. No HTTP here — which status each maps to is declared by
 * the endpoints that document it, in `ui/http`.
 */
export * from './user-not-found.error';
export * from './user-registration-failed.error';
