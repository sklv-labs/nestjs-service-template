import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import type { LoggerService } from '../logger';

export type RequestLoggingOptions = {
  /** Log parsed request bodies. Redaction applies, but see the caveat in the module docs. */
  body?: boolean;
  /** Log request headers. Sensitive ones are redacted by the logger, not dropped here. */
  headers?: boolean;
  query?: boolean;
  /**
   * Bodies larger than this are replaced with a marker. An upload or a bulk import will otherwise
   * put megabytes per request into log storage.
   */
  maxBodyBytes?: number;
  /** Paths that should not be logged at all — health probes and docs are pure noise. */
  ignore?: (url: string) => boolean;
  level?: 'info' | 'debug';
};

const DEFAULTS = {
  body: true,
  headers: true,
  query: true,
  maxBodyBytes: 4096,
  // Substring, not prefix: a global prefix makes the health route `/api/v1/health`, and a
  // prefix check silently stops ignoring it.
  ignore: (url: string) => url.includes('/health') || url.includes('/docs'),
  level: 'info' as const,
};

type FastifyLike = {
  addHook: (event: string, handler: (...args: never[]) => void) => void;
};

const truncate = (body: unknown, max: number): unknown => {
  if (body === undefined || body === null) {
    return undefined;
  }

  const size = Buffer.byteLength(JSON.stringify(body) ?? '');

  return size > max ? `[body omitted: ${size} bytes]` : body;
};

/**
 * One detailed line per request, on completion.
 *
 * Registered as a Fastify hook rather than a Nest interceptor so it also covers requests Nest never
 * routes — 404s, malformed bodies, plugin rejections — which is exactly where you want detail.
 * Fastify's own two-line access log is disabled in favour of this.
 *
 * **On logging bodies.** Redaction is the only thing standing between this and credentials in log
 * storage forever. The paths in the logger's `redact` list must match the shape produced here
 * (`req.body.password`, not `password`), and adding a new secret-bearing field to a contract means
 * adding a redact path. This is opt-out per environment for a reason: log storage is rarely as
 * access-controlled as a database, and nothing here can un-log a value.
 */
export const registerRequestLogging = (
  app: NestFastifyApplication,
  logger: LoggerService,
  options: RequestLoggingOptions = {},
): void => {
  const opts = { ...DEFAULTS, ...options };
  const log = logger.forContext('Request');
  // `Logger` exposes `log`, matching Nest; `info` is pino's name for the same level.
  const emit = opts.level === 'debug' ? log.debug : log.log;
  const instance = app.getHttpAdapter().getInstance() as unknown as FastifyLike;

  instance.addHook('onResponse', ((
    request: {
      method: string;
      url: string;
      headers: Record<string, unknown>;
      query?: unknown;
      params?: unknown;
      body?: unknown;
    },
    reply: { statusCode: number; elapsedTime?: number },
    done: () => void,
  ) => {
    if (opts.ignore(request.url)) {
      done();
      return;
    }

    emit(
      {
        req: {
          method: request.method,
          url: request.url,
          ...(opts.headers ? { headers: request.headers } : {}),
          ...(opts.query ? { query: request.query } : {}),
          ...(request.params ? { params: request.params } : {}),
          ...(opts.body ? { body: truncate(request.body, opts.maxBodyBytes) } : {}),
        },
        res: {
          statusCode: reply.statusCode,
          durationMs: Math.round((reply.elapsedTime ?? 0) * 100) / 100,
        },
      },
      `${request.method} ${request.url} ${reply.statusCode}`,
    );

    done();
  }) as never);
};
