import type {
  DynamicModule,
  InjectionToken,
  OptionalFactoryDependency,
  Provider,
} from '@nestjs/common';
import { Global, Module } from '@nestjs/common';

import { LOG_CONTEXT, LOGGER_INSTANCE } from './logger.constants';
import { createLogger } from './logger.factory';
import { LOGGER, loggerProvider } from './logger.decorator';
import type { LoggerModuleOptions } from './logger.types';
import { LoggerService } from './logger.service';

const toInstance = (options: LoggerModuleOptions) =>
  'instance' in options ? options.instance : createLogger(options);

/**
 * Only registered when the application names a context provider, so `@Optional()` on the
 * injection is what makes the logger usable with no context at all.
 */
const contextProvider = (options: LoggerModuleOptions): Provider[] =>
  options.context === undefined ? [] : [{ provide: LOG_CONTEXT, useExisting: options.context }];

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
        ...contextProvider(options),
        LoggerService,
        loggerProvider,
      ],
      exports: [LoggerService, LOGGER, LOGGER_INSTANCE],
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
        LoggerService,
        loggerProvider,
      ],
      exports: [LoggerService, LOGGER, LOGGER_INSTANCE],
    };
  }
}
