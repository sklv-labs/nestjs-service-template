import type { Level, Logger as PinoLogger } from 'pino';

import type { LogContext } from './logger.types';

/**
 * Nest's `LoggerService` passes the context as a trailing string, so it is stripped and promoted to
 * a field.
 *
 * This applies **only** to calls arriving through Nest. {@link Logger} already has its context
 * bound, and applying the same heuristic there swallows the message of `log(fields, 'message')`.
 */
export const writeFromNest = (
  logger: PinoLogger,
  requestContext: LogContext | undefined,
  level: Level,
  message: unknown,
  params: unknown[],
): void => {
  const context = typeof params.at(-1) === 'string' ? (params.pop() as string) : undefined;

  write(logger, requestContext, level, message, params, context ? { context } : undefined);
};

/**
 * Normalises the shapes callers use — a string, an Error, or an object of fields — because pino
 * wants `(mergingObject, message)` and no call site should have to think about it.
 */
export const write = (
  logger: PinoLogger,
  requestContext: LogContext | undefined,
  level: Level,
  message: unknown,
  params: unknown[],
  extra?: Record<string, unknown>,
): void => {
  const bindings = { ...requestContext?.bindings(), ...extra };

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
