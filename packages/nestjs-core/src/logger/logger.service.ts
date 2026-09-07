import type { LoggerService as NestLoggerService } from '@nestjs/common';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { Level, Logger as PinoLogger } from 'pino';

import { LOGGER_INSTANCE, LOGGER_REQUEST_ID_KEY } from './logger.options';

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
 * CLS is optional. Without it everything still works, just without the correlation id.
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(
    @Inject(LOGGER_INSTANCE) private readonly root: PinoLogger,
    @Inject(LOGGER_REQUEST_ID_KEY) private readonly idKey: string,
    @Optional() private readonly cls?: ClsService,
  ) {}

  /** A logger bound to a class or subsystem. The child is created once. */
  forContext(context: string): Logger {
    return new Logger(this.root.child({ context }), this.idKey, this.cls);
  }

  /** The pino instance, for anything needing a raw stream or a custom child. */
  get pino(): PinoLogger {
    return this.root;
  }

  log(message: unknown, ...params: unknown[]): void {
    writeFromNest(this.root, this.idKey, this.cls, 'info', message, params);
  }

  error(message: unknown, ...params: unknown[]): void {
    writeFromNest(this.root, this.idKey, this.cls, 'error', message, params);
  }

  warn(message: unknown, ...params: unknown[]): void {
    writeFromNest(this.root, this.idKey, this.cls, 'warn', message, params);
  }

  debug(message: unknown, ...params: unknown[]): void {
    writeFromNest(this.root, this.idKey, this.cls, 'debug', message, params);
  }

  verbose(message: unknown, ...params: unknown[]): void {
    writeFromNest(this.root, this.idKey, this.cls, 'trace', message, params);
  }

  fatal(message: unknown, ...params: unknown[]): void {
    writeFromNest(this.root, this.idKey, this.cls, 'fatal', message, params);
  }
}

/**
 * What application code injects, via `@InjectLogger()`. Its context is already bound, so calls read
 * as `logger.debug({ orderId }, 'Order settled')` with no ceremony.
 */
export class Logger {
  constructor(
    private readonly logger: PinoLogger,
    private readonly idKey: string,
    private readonly cls?: ClsService,
  ) {}

  log = (message: unknown, ...params: unknown[]) =>
    write(this.logger, this.idKey, this.cls, 'info', message, params);
  error = (message: unknown, ...params: unknown[]) =>
    write(this.logger, this.idKey, this.cls, 'error', message, params);
  warn = (message: unknown, ...params: unknown[]) =>
    write(this.logger, this.idKey, this.cls, 'warn', message, params);
  debug = (message: unknown, ...params: unknown[]) =>
    write(this.logger, this.idKey, this.cls, 'debug', message, params);

  /** A further-nested child, for a subsystem inside one class. */
  child(bindings: Record<string, unknown>): Logger {
    return new Logger(this.logger.child(bindings), this.idKey, this.cls);
  }
}

/**
 * `cls.getId()` throws outside a context, which a startup task or a cron tick legitimately is.
 * Losing the id there is fine; crashing is not.
 */
const requestId = (key: string, cls?: ClsService): Record<string, string> | undefined =>
  cls?.isActive() ? { [key]: cls.getId() } : undefined;

/**
 * Nest's `LoggerService` passes the context as a trailing string, so it is stripped and promoted to
 * a field.
 *
 * This applies **only** to calls arriving through Nest. {@link Logger} already has its context
 * bound, and applying the same heuristic there swallows the message of `log(fields, 'message')`.
 */
const writeFromNest = (
  logger: PinoLogger,
  idKey: string,
  cls: ClsService | undefined,
  level: Level,
  message: unknown,
  params: unknown[],
): void => {
  const context = typeof params.at(-1) === 'string' ? (params.pop() as string) : undefined;

  write(logger, idKey, cls, level, message, params, context ? { context } : undefined);
};

/**
 * Normalises the shapes callers use — a string, an Error, or an object of fields — because pino
 * wants `(mergingObject, message)` and no call site should have to think about it.
 */
const write = (
  logger: PinoLogger,
  idKey: string,
  cls: ClsService | undefined,
  level: Level,
  message: unknown,
  params: unknown[],
  extra?: Record<string, unknown>,
): void => {
  const bindings = { ...requestId(idKey, cls), ...extra };

  if (message instanceof Error) {
    logger[level]({ ...bindings, err: message }, message.message);
    return;
  }

  if (typeof message === 'object' && message !== null) {
    logger[level]({ ...bindings, ...message }, params.length ? String(params[0]) : undefined);
    return;
  }

  logger[level](bindings, String(message));
};
