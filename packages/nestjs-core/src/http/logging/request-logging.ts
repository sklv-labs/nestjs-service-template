import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import type { Logger, LoggerService } from '../../logger';

export type RequestLoggingOptions = {
  /** Log parsed request bodies. Redaction applies — see the caveat below. */
  body?: boolean;
  headers?: boolean;
  query?: boolean;
  /**
   * Response headers to log. `true` uses the allowlist below; pass an array to choose, or `'all'`
   * for everything.
   *
   * An allowlist rather than everything, because security middleware sets a dozen constant headers
   * on every response — identical every time, and pure volume in log storage.
   */
  responseHeaders?: boolean | 'all' | string[];
  /**
   * Log response payloads. Off by default: responses are stripped to their contract, so they rarely
   * hold credentials, but they routinely hold personal data.
   */
  responseBody?: boolean;
  /**
   * Bodies larger than this are replaced with a marker, in both directions. An upload or a large
   * page would otherwise put megabytes per request into log storage.
   */
  maxBodyBytes?: number;
  /**
   * Wire names the context carries. Merged into the response-header allowlist, so an echoed
   * context header is logged without this module knowing any field's name.
   */
  carrierHeaders?: readonly string[];
  /** Paths not worth logging — health probes and docs are pure noise. */
  ignore?: (url: string) => boolean;
  level?: 'info' | 'debug';
};

const DEFAULTS = {
  body: true,
  headers: true,
  query: true,
  responseHeaders: true as boolean | 'all' | string[],
  carrierHeaders: [] as readonly string[],
  responseBody: false,
  maxBodyBytes: 4096,
  // Substring, not prefix: a global prefix makes the health route `/api/v1/health`, and a prefix
  // check silently stops ignoring it.
  ignore: (url: string) => url.includes('/health') || url.includes('/docs'),
  level: 'info' as const,
};

/** Response headers that actually vary or aid diagnosis. Context headers are added by the caller. */
const HEADER_ALLOWLIST = [
  'content-type',
  'content-length',
  'location',
  'cache-control',
  'etag',
  'retry-after',
  'set-cookie',
];

const PAYLOAD = Symbol('response.payload');

const pickHeaders = (
  headers: Record<string, unknown> | undefined,
  select: boolean | 'all' | string[],
  extra: readonly string[] = [],
): Record<string, unknown> | undefined => {
  if (!headers || select === false) {
    return undefined;
  }

  if (select === 'all') {
    return headers;
  }

  const keys = [...(Array.isArray(select) ? select : HEADER_ALLOWLIST), ...extra];

  return Object.fromEntries(
    keys.filter((key) => headers[key] !== undefined).map((key) => [key, headers[key]]),
  );
};

/**
 * Only the hook registration is needed from the Fastify instance, and typing it structurally keeps
 * this module free of Fastify's types.
 */
type FastifyLike = { addHook: (event: string, handler: (...args: never[]) => void) => void };

type Req = {
  method: string;
  url: string;
  headers: Record<string, unknown>;
  query?: unknown;
  params?: unknown;
  body?: unknown;
  [PAYLOAD]?: unknown;
};

type Reply = {
  statusCode: number;
  elapsedTime?: number;
  getHeaders?: () => Record<string, unknown>;
};

const cap = (value: unknown, max: number, bytes?: number): unknown => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const size = bytes ?? Buffer.byteLength(JSON.stringify(value) ?? '');

  return size > max ? `[body omitted: ${size} bytes]` : value;
};

/**
 * A serialized payload is a string, and pino's redaction matches object paths — so a JSON body
 * logged as a string would bypass redaction entirely. Parsing it back is the price of keeping the
 * response body redactable.
 */
const parsePayload = (payload: unknown, max: number): unknown => {
  if (typeof payload !== 'string') {
    // A stream or Buffer: logging it would consume or bloat it.
    return payload === undefined ? undefined : '[non-serializable payload]';
  }

  const bytes = Buffer.byteLength(payload);

  if (bytes > max) {
    return `[body omitted: ${bytes} bytes]`;
  }

  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
};

/**
 * One detailed line per request, on completion, covering both directions.
 *
 * Registered as a Fastify hook rather than a Nest interceptor so it also covers requests Nest never
 * routes — 404s, malformed bodies, plugin rejections — which is exactly where detail is wanted.
 * Fastify's own two-line access log is disabled in favour of this.
 *
 * **On logging bodies.** Redaction is the only thing standing between this and personal data or
 * credentials in log storage forever. The paths in the logger's `redact` list must match the shape
 * produced here (`req.body.password`, `res.body.email`), and adding a sensitive field to a contract
 * means adding a redact path. Nothing here can un-log a value.
 */
export const registerRequestLogging = (
  app: NestFastifyApplication,
  logger: LoggerService,
  options: RequestLoggingOptions = {},
): void => {
  const opts = { ...DEFAULTS, ...options };
  const log = logger.forContext('Request');
  const instance = app.getHttpAdapter().getInstance() as unknown as FastifyLike;

  if (opts.responseBody) {
    instance.addHook('onSend', (req: Req, _reply: Reply, payload: unknown, done: () => void) => {
      req[PAYLOAD] = payload;
      done();
    });
  }

  instance.addHook('onResponse', (req: Req, reply: Reply, done: () => void) => {
    if (opts.ignore(req.url)) {
      done();
      return;
    }

    const allHeaders = reply.getHeaders?.();
    const headers = pickHeaders(allHeaders, opts.responseHeaders, opts.carrierHeaders);
    const bytes = Number(allHeaders?.['content-length'] ?? 0) || undefined;

    // 5xx is our fault and belongs in the error log; everything else is the access log.
    const emit = reply.statusCode >= 500 ? log.error : opts.level === 'debug' ? log.debug : log.log;

    emit(
      {
        req: {
          method: req.method,
          url: req.url,
          ...(opts.headers ? { headers: req.headers } : {}),
          ...(opts.query ? { query: req.query } : {}),
          ...(req.params ? { params: req.params } : {}),
          ...(opts.body ? { body: cap(req.body, opts.maxBodyBytes) } : {}),
        },
        res: {
          statusCode: reply.statusCode,
          durationMs: Math.round((reply.elapsedTime ?? 0) * 100) / 100,
          ...(bytes ? { bytes } : {}),
          ...(headers ? { headers } : {}),
          ...(opts.responseBody ? { body: parsePayload(req[PAYLOAD], opts.maxBodyBytes) } : {}),
        },
      },
      `${req.method} ${req.url} ${reply.statusCode}`,
    );

    done();
  });
};

export type { Logger };
