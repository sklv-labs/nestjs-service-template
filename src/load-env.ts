import path from 'node:path';

import { loadEnv } from '@sklv-labs/nestjs-config';

/**
 * Side-effect module: loads `.env` when it is required.
 *
 * `ConfigModule.forRoot` validates `process.env` while `app.module.ts` is being evaluated, so the
 * environment has to be in place before that module is loaded. Importing this file first works
 * because TypeScript compiles imports to `require` calls in source order — put it above every
 * other import in `main.ts` and keep it there.
 */
loadEnv({ config: { path: path.resolve(process.cwd(), '.env') }, silent: true });
