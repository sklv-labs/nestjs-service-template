/** An already-built pino instance, shared by the framework adapter and Nest. */
export const LOGGER_INSTANCE = Symbol('LOGGER_INSTANCE');

/** A provider satisfying `LogContext`, whose fields are merged into every line. */
export const LOG_CONTEXT = Symbol('LOG_CONTEXT');

/**
 * Redaction paths must match the *shape that is logged*, not the field name in isolation: pino
 * matches paths, and `*.password` covers one level only. Request logging nests everything under
 * `req`, so those paths are spelled out explicitly.
 *
 * Adding a secret-bearing field to a contract means adding it here. There is no way to un-log a
 * value once it is written.
 */
export const DEFAULT_REDACT = [
  'password',
  '*.password',
  'passwordHash',
  '*.passwordHash',
  'token',
  '*.token',
  'secret',
  '*.secret',

  // request logging
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.headers["x-api-key"]',
  'req.headers["proxy-authorization"]',
  'req.body.password',
  'req.body.passwordHash',
  'req.body.token',
  'req.body.secret',
  'req.body.accessToken',
  'req.body.refreshToken',
  'req.body.*.password',
  'req.body.*.token',

  // response logging — the same paths apply outbound
  'res.headers["set-cookie"]',
  'res.body.password',
  'res.body.passwordHash',
  'res.body.token',
  'res.body.accessToken',
  'res.body.refreshToken',
  'res.body.secret',
  'res.body.*.password',
  'res.body.*.token',
];
