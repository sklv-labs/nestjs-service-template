import type { Logger as DrizzleLogger } from 'drizzle-orm';

import type { Logger } from '../logger';

export type QueryLoggerOptions = {
  /**
   * Log bound parameter values.
   *
   * Off by default, and that is a security decision rather than a volume one: parameters are the
   * data — emails, tokens, password hashes — and they arrive as a positional array, so the
   * logger's redaction paths cannot reach inside them. There is no way to un-log a value.
   */
  params?: boolean;
};

/**
 * Bridges drizzle's query logging into the application logger.
 *
 * It knows nothing about request context. Every line this writes already carries the context's
 * declared fields, because that is the logger's job — the previous version pulled a hardcoded list
 * of CLS keys (`requestId`, `correlationId`, `traceId`, `spanId`, `userId`) out of the store here,
 * which is both duplicated policy and a guess at what the application declared.
 */
export class QueryLogger implements DrizzleLogger {
  constructor(
    private readonly logger: Logger,
    private readonly options: QueryLoggerOptions = {},
  ) {}

  logQuery(query: string, params: unknown[]): void {
    this.logger.debug(this.options.params ? { query, params } : { query }, 'Query');
  }
}
