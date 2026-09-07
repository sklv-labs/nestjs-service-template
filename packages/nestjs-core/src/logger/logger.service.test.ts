import { pino } from 'pino';
import { describe, expect, it } from 'vitest';

import type { LogContext } from './logger.types';
import { LoggerService } from './logger.service';

/** Captures what pino actually wrote, so these assert output rather than call arguments. */
const capture = () => {
  const lines: Record<string, unknown>[] = [];

  const logger = pino(
    { level: 'trace', base: undefined, timestamp: false },
    {
      write: (line: string) => {
        lines.push(JSON.parse(line) as Record<string, unknown>);
      },
    },
  );

  return { lines, logger };
};

const contextOf = (bindings: Record<string, unknown> | undefined): LogContext => ({
  bindings: () => bindings,
});

describe('context bindings', () => {
  it('merges whatever the context provides, naming no field itself', () => {
    const { lines, logger } = capture();
    const service = new LoggerService(logger, contextOf({ reqId: 'abc', tenantId: 't1' }));

    service.log('hello');

    expect(lines[0]).toMatchObject({ reqId: 'abc', tenantId: 't1', msg: 'hello' });
  });

  it('logs without a context at all', () => {
    const { lines, logger } = capture();

    new LoggerService(logger).log('hello');

    expect(lines[0]).toMatchObject({ msg: 'hello' });
  });

  it('logs when the context is active but empty', () => {
    const { lines, logger } = capture();

    new LoggerService(logger, contextOf(undefined)).log('hello');

    expect(lines[0]).toMatchObject({ msg: 'hello' });
  });
});

describe('call shapes', () => {
  it('treats a trailing string from Nest as the context, which is how Nest calls it', () => {
    const { lines, logger } = capture();

    new LoggerService(logger).log('Mapped {/users, POST}', 'RouterExplorer');

    expect(lines[0]).toMatchObject({ context: 'RouterExplorer', msg: 'Mapped {/users, POST}' });
  });

  it('keeps the message of a bound logger call, and does not mistake it for a context', () => {
    const { lines, logger } = capture();
    const bound = new LoggerService(logger, contextOf({ reqId: 'abc' })).forContext('UsersService');

    bound.debug({ userId: 'u1' }, 'Created user');

    // Regression: applying Nest's trailing-string heuristic here filed the message as `context`
    // and the line went out with no message at all.
    expect(lines[0]).toMatchObject({
      context: 'UsersService',
      reqId: 'abc',
      userId: 'u1',
      msg: 'Created user',
    });
  });

  it('reports an Error with its message and stack', () => {
    const { lines, logger } = capture();

    new LoggerService(logger).error(new Error('boom'));

    expect(lines[0]).toMatchObject({ msg: 'boom' });
    expect((lines[0] as { err?: { stack?: string } }).err?.stack).toContain('boom');
  });

  it('binds a class context once, as a child logger', () => {
    const { lines, logger } = capture();
    const bound = new LoggerService(logger).forContext('UsersService');

    bound.log('one');
    bound.child({ subsystem: 'cache' }).log('two');

    expect(lines[0]).toMatchObject({ context: 'UsersService', msg: 'one' });
    expect(lines[1]).toMatchObject({ context: 'UsersService', subsystem: 'cache', msg: 'two' });
  });
});
