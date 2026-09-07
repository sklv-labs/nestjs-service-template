import type { InjectionToken } from '@nestjs/common';
import type { Level, Logger as PinoLogger } from 'pino';

export type LoggerOptions = {
  /** Emitted on every line so several services can share one stream. */
  service: string;
  environment?: string;
  version?: string;
  level?: Level;
  /**
   * Human-readable output through pino-pretty. Development only: it costs a worker thread and
   * destroys the structure that makes logs queryable.
   */
  pretty?: boolean;
  /**
   * Paths scrubbed before writing. The defaults cover credentials and tokens; add domain-specific
   * ones rather than trusting every call site to remember.
   */
  redact?: string[];
};

/** An already-built pino instance, so Fastify and Nest log through the same one. */
export type LoggerBackend = LoggerOptions | { instance: PinoLogger };

export type LoggerModuleOptions = LoggerBackend & {
  /**
   * A provider satisfying `LogContext`, whose fields are merged into every line. Passed by the
   * application so the logger keeps no dependency on where context comes from — and so no field
   * name (`reqId` included) is written here.
   */
  context?: InjectionToken;
};

export const LOGGER_INSTANCE = Symbol('LOGGER_INSTANCE');

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
