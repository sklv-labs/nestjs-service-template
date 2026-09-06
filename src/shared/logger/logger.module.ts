import type { DynamicModule, InjectionToken, OptionalFactoryDependency } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';

import { createLogger } from './create-logger';
import type { LoggerModuleOptions } from './logger.options';
import { DEFAULT_REQUEST_ID_KEY, LOGGER_INSTANCE, LOGGER_REQUEST_ID_KEY } from './logger.options';
import { Logger } from './logger.service';

const toInstance = (options: LoggerModuleOptions) =>
  'instance' in options ? options.instance : createLogger(options);

const toIdKey = (options: LoggerModuleOptions) =>
  ('instance' in options ? undefined : options.requestIdKey) ?? DEFAULT_REQUEST_ID_KEY;

/**
 * Global and singleton. The logger is on the hot path of every request, so it is never
 * request-scoped and never rebuilt per module.
 */
@Global()
@Module({})
export class LoggerModule {
  static forRoot(options: LoggerModuleOptions): DynamicModule {
    return {
      module: LoggerModule,
      providers: [
        { provide: LOGGER_INSTANCE, useValue: toInstance(options) },
        { provide: LOGGER_REQUEST_ID_KEY, useValue: toIdKey(options) },
        Logger,
      ],
      exports: [Logger, LOGGER_INSTANCE],
    };
  }

  static forRootAsync(config: {
    inject?: (InjectionToken | OptionalFactoryDependency)[];
    useFactory: (...args: never[]) => LoggerModuleOptions | Promise<LoggerModuleOptions>;
  }): DynamicModule {
    return {
      module: LoggerModule,
      providers: [
        {
          provide: LOGGER_INSTANCE,
          inject: config.inject ?? [],
          useFactory: async (...args: never[]) => toInstance(await config.useFactory(...args)),
        },
        {
          provide: LOGGER_REQUEST_ID_KEY,
          inject: config.inject ?? [],
          useFactory: async (...args: never[]) => toIdKey(await config.useFactory(...args)),
        },
        Logger,
      ],
      exports: [Logger, LOGGER_INSTANCE],
    };
  }
}
