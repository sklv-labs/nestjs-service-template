import { Injectable } from '@nestjs/common';
import { ServiceBaseConfigService } from '@sklv-labs/nestjs-config';

// The documented API's identity, resolved at compile time. `npm_package_*` would be simpler but is
// absent unless the process was started by a package script, which silently produced a document
// titled "unknown".
import { name, version } from '../../package.json';

import type { EnvType } from './env.schema';

@Injectable()
export class ConfigService extends ServiceBaseConfigService<EnvType> {
  globalPrefix = 'api/v1';

  database = { url: this.env.DATABASE_URL };

  logging = {
    level: this.env.LOG_LEVEL,
    json: this.env.LOG_JSON,
    requestBody: this.env.LOG_REQUEST_BODY,
    responseBody: this.env.LOG_RESPONSE_BODY,
  };

  /**
   * `openapi.json` is committed and diffed in CI, so nothing here may vary with the environment —
   * the environment used to appear in the description, which made the artefact differ between a
   * developer's machine and the CI runner.
   */
  docs = {
    enabled: this.env.DOCS_ENABLED,
    path: this.env.DOCS_PATH,
    title: name,
    version,
    description: `OpenAPI documentation for ${name}.`,
  };
}
