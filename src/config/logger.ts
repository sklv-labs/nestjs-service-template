import { getEnvironment } from '@sklv-labs/core/environment';

import { name, version } from '../../package.json';

import { createLogger } from '@sklv-labs/nestjs-core/logger';

/**
 * The one pino instance for this process.
 *
 * A module-level const rather than a provider, because Fastify needs it *before* Nest exists —
 * `loggerInstance` is an adapter option. Both `main.ts` and `LoggerModule` import this, so module
 * evaluation guarantees a single instance without a mutable global or an init-order dance.
 *
 * It reads the environment directly: this runs before the config module, and logging configuration
 * is bootstrap configuration. `load-env` has already loaded `.env` by the time this evaluates.
 *
 * It lives in the service rather than in `@sklv-labs/nestjs-core`, which exports `createLogger`
 * and nothing pre-built: the instance reads this service's environment and its own package.json,
 * which is composition, not library code.
 */
export const logger = createLogger({
  // SERVICE_NAME/VERSION are what deployment sets, and they win. The fallback is resolved at
  // compile time rather than from `npm_package_*`, which is empty under `node dist/src/main.js`
  // and made every line in CI read `"service":"unknown"`.
  service: process.env.SERVICE_NAME ?? name,
  version: process.env.SERVICE_VERSION ?? version,
  environment: getEnvironment(),
  level: (process.env.LOG_LEVEL as never) ?? 'info',
  pretty: process.env.LOG_JSON !== 'true',
});
