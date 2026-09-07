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

/**
 * What the logger needs from a request context, and nothing else.
 *
 * Declared by the consumer rather than the provider: the logger never imports the context area,
 * and `Context` satisfies this structurally without importing the logger. The application wires
 * them together — `LoggerModule.forRoot({ instance, context: Context })` — so either area is
 * usable without the other.
 */
export type LogContext = {
  /** Fields to merge into every line, already assembled. */
  bindings: () => Record<string, unknown> | undefined;
};
