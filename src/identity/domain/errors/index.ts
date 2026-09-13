/**
 * Business errors this domain can raise. No HTTP here — which status each maps to is declared by
 * the endpoints that document it, in `ui/http`.
 */
export * from './auth-method-conflict.error';
export * from './auth-method-not-found.error';
export * from './auth-method-required.error';
export * from './concurrent-modification.error';
export * from './invalid-email.error';
export * from './user-not-found.error';
export * from './user-registration-failed.error';
