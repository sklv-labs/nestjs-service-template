import type { LoggerService as NestLoggerService } from '@nestjs/common';
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Logger as PinoLogger } from 'pino';

import { LOG_CONTEXT, LOGGER_INSTANCE } from './logger.constants';
import type { LogContext } from './logger.types';
import { write, writeFromNest } from './logger.writer';

/**
 * The root logger, and the adapter Nest itself logs through.
 *
 * Application code does not inject this — it injects {@link Logger}, which is already bound to a
 * context. This exists for `app.useLogger()`, so framework output shares the format, and as the
 * factory behind `@InjectLogger()`.
 *
 * The design rule is what happens *per line*: one property merge, nothing else. Static fields live
 * in pino's bindings, bound once, and a class context is a child logger created once.
 *
 * The context is optional, and the logger names none of its fields: it merges whatever
 * `LogContext` hands over. Without a context everything still works, just uncorrelated.
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(
    @Inject(LOGGER_INSTANCE) private readonly root: PinoLogger,
    @Optional() @Inject(LOG_CONTEXT) private readonly requestContext?: LogContext,
  ) {}

  /** A logger bound to a class or subsystem. The child is created once. */
  forContext(context: string): Logger {
    return new Logger(this.root.child({ context }), this.requestContext);
  }

  /** The pino instance, for anything needing a raw stream or a custom child. */
  get pino(): PinoLogger {
    return this.root;
  }

  log(message: unknown, ...params: unknown[]): void {
    writeFromNest(this.root, this.requestContext, 'info', message, params);
  }

  error(message: unknown, ...params: unknown[]): void {
    writeFromNest(this.root, this.requestContext, 'error', message, params);
  }

  warn(message: unknown, ...params: unknown[]): void {
    writeFromNest(this.root, this.requestContext, 'warn', message, params);
  }

  debug(message: unknown, ...params: unknown[]): void {
    writeFromNest(this.root, this.requestContext, 'debug', message, params);
  }

  verbose(message: unknown, ...params: unknown[]): void {
    writeFromNest(this.root, this.requestContext, 'trace', message, params);
  }

  fatal(message: unknown, ...params: unknown[]): void {
    writeFromNest(this.root, this.requestContext, 'fatal', message, params);
  }
}

/**
 * What application code injects, via `@InjectLogger()`. Its context is already bound, so calls read
 * as `logger.debug({ orderId }, 'Order settled')` with no ceremony.
 */
export class Logger {
  constructor(
    private readonly logger: PinoLogger,
    private readonly requestContext?: LogContext,
  ) {}

  log = (message: unknown, ...params: unknown[]) =>
    write(this.logger, this.requestContext, 'info', message, params);
  error = (message: unknown, ...params: unknown[]) =>
    write(this.logger, this.requestContext, 'error', message, params);
  warn = (message: unknown, ...params: unknown[]) =>
    write(this.logger, this.requestContext, 'warn', message, params);
  debug = (message: unknown, ...params: unknown[]) =>
    write(this.logger, this.requestContext, 'debug', message, params);

  /** A further-nested child, for a subsystem inside one class. */
  child(bindings: Record<string, unknown>): Logger {
    return new Logger(this.logger.child(bindings), this.requestContext);
  }
}
