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
  /**
   * Field name for the correlation id.
   *
   * Defaults to Fastify's own `reqId` so framework access lines and application lines are one
   * queryable field. Fastify's `requestIdLogLabel` could rename its side instead, but it is
   * deprecated and removed in Fastify 6 — matching the framework is the durable direction.
   */
  requestIdKey?: string;
};

/** An already-built pino instance, so Fastify and Nest log through the same one. */
export type LoggerModuleOptions = LoggerOptions | { instance: PinoLogger };

export const LOGGER_INSTANCE = Symbol('LOGGER_INSTANCE');
export const LOGGER_REQUEST_ID_KEY = Symbol('LOGGER_REQUEST_ID_KEY');

export const DEFAULT_REQUEST_ID_KEY = 'reqId';

export const DEFAULT_REDACT = [
  'password',
  '*.password',
  'passwordHash',
  '*.passwordHash',
  'token',
  '*.token',
  'secret',
  '*.secret',
  'req.headers.authorization',
  'req.headers.cookie',
];
