import type { LoggerService as NestLoggerService } from '@nestjs/common';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { Level, Logger as PinoLogger } from 'pino';

import { LOGGER_INSTANCE, LOGGER_REQUEST_ID_KEY } from './logger.options';

/**
 * Structured logging with the correlation id attached automatically.
 *
 * The whole design is about what happens per line: one property merge, and nothing else. No stack
 * inspection to guess the calling class, no context object rebuilt per call, no per-key validation.
 * Static fields live in pino's bindings and a class context is a child logger created once.
 *
 * CLS is optional. Without it the logger still works, just without `requestId` — so this module can
 * be used on its own.
 */
@Injectable()
export class Logger implements NestLoggerService {
  constructor(
    @Inject(LOGGER_INSTANCE) private readonly root: PinoLogger,
    @Inject(LOGGER_REQUEST_ID_KEY) private readonly idKey: string,
    @Optional() private readonly cls?: ClsService,
  ) {}

  /**
   * A logger bound to a class or subsystem. The child is created once, so the context costs
   * nothing per line.
   */
  forContext(context: string): ContextLogger {
    return new ContextLogger(this.root.child({ context }), this.idKey, this.cls);
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

/** A logger whose context is already bound. Returned by `Logger.forContext`. */
export class ContextLogger {
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
}

/**
 * `cls.getId()` throws outside a context, which a startup task or a cron tick legitimately is.
 * Losing the id is fine there; crashing is not.
 */
const requestId = (key: string, cls?: ClsService): Record<string, string> | undefined =>
  cls?.isActive() ? { [key]: cls.getId() } : undefined;

/**
 * Nest's `LoggerService` passes the context as a trailing string, so it is stripped here and
 * promoted to a field.
 *
 * This applies **only** to calls arriving through Nest. `ContextLogger` already has its context
 * bound into a child, and applying the same heuristic there swallows the message of any
 * `log(fields, 'message')` call — which it did, until it didn't.
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
