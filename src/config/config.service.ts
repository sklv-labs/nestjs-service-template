import { Injectable } from '@nestjs/common';
import { getAppName, getAppVersion, getEnvironment } from '@sklv-labs/core/environment';
import { ServiceBaseConfigService } from '@sklv-labs/nestjs-config';

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

  docs = {
    enabled: this.env.DOCS_ENABLED,
    path: this.env.DOCS_PATH,
    title: getAppName(),
    version: getAppVersion(),
    description: `OpenAPI documentation for ${getAppName()} (${getEnvironment() ?? 'unknown'}).`,
  };
}
