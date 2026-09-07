import pino from 'pino';

import { DEFAULT_REDACT } from './logger.constants';
import type { LoggerOptions } from './logger.types';

/**
 * Builds the one pino instance the process uses.
 *
 * Exported rather than hidden inside the module because Fastify needs the same instance: passing it
 * as `loggerInstance` puts the framework's access log — including requests that never reach Nest —
 * into the same stream, with the same format and the same redaction.
 *
 * Everything static is bound here, once. Nothing in this package recomputes service, version or
 * environment per line.
 */
export const createLogger = (options: LoggerOptions): pino.Logger =>
  pino({
    level: options.level ?? 'info',
    base: {
      service: options.service,
      ...(options.environment ? { env: options.environment } : {}),
      ...(options.version ? { version: options.version } : {}),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    // Without this `level` is a number, which is unreadable when grepping.
    formatters: { level: (label) => ({ level: label }) },
    redact: options.redact ?? DEFAULT_REDACT,
    ...(options.pretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
          },
        }
      : {}),
  });
