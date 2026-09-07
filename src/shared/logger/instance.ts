import { getAppName, getAppVersion, getEnvironment } from '@sklv-labs/core/environment';

import { createLogger } from './create-logger';

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
 * Deliberately not re-exported from `./index`: everything else here is library code, while this
 * file is the application composing it. When `shared/` becomes a package, this is what each
 * service keeps.
 */
export const logger = createLogger({
  // npm_package_* only exist when started through a package script, and a container runs
  // `node dist/src/main.js`. SERVICE_NAME/VERSION are what deployment actually sets.
  service: process.env.SERVICE_NAME ?? getAppName(),
  version: process.env.SERVICE_VERSION ?? getAppVersion(),
  environment: getEnvironment(),
  level: (process.env.LOG_LEVEL as never) ?? 'info',
  pretty: process.env.LOG_JSON !== 'true',
});
