import type { DynamicModule, InjectionToken, OnApplicationShutdown } from '@nestjs/common';
import { Global, Inject, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { LoggerService } from '../logger';

import { DATABASE, PG_POOL } from './database.constants';
import { QueryLogger } from './database.logger';

export type DatabaseModuleOptions = {
  /** Connection string. */
  url: string;
  pool?: {
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  };
  /** Log every statement at debug. */
  logQueries?: boolean;
  /** Include bound parameters — the data itself. See `QueryLoggerOptions`. */
  logQueryParams?: boolean;
  /**
   * Just-in-time compiled row mappers (Drizzle v1). Faster on large result sets, at the cost of
   * compiling a mapper per query shape.
   */
  jit?: boolean;
};

export type DatabaseModuleAsyncOptions = {
  imports?: DynamicModule['imports'];
  inject?: InjectionToken[];
  useFactory: (...args: never[]) => DatabaseModuleOptions | Promise<DatabaseModuleOptions>;
};

/**
 * A pool and a drizzle client over it, and nothing else.
 *
 * One dialect, no dynamic driver resolution: the previous version imported one of four drivers at
 * runtime inside a `try/catch` that reported *any* failure — a wrong password included — as
 * "driver is not installed".
 *
 * Global, because a database is not a per-module concern. The pool closes on shutdown so the
 * process can exit.
 */
@Global()
@Module({})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  static forRoot(options: DatabaseModuleOptions): DynamicModule {
    return DatabaseModule.forRootAsync({ useFactory: () => options });
  }

  /** The one implementation; `forRoot` delegates here rather than duplicating it. */
  static forRootAsync(options: DatabaseModuleAsyncOptions): DynamicModule {
    return {
      module: DatabaseModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: PG_POOL,
          inject: options.inject ?? [],
          useFactory: async (...args: never[]) => {
            const config = await options.useFactory(...args);

            return new Pool({
              connectionString: config.url,
              max: config.pool?.max ?? 20,
              idleTimeoutMillis: config.pool?.idleTimeoutMillis ?? 30_000,
              connectionTimeoutMillis: config.pool?.connectionTimeoutMillis ?? 10_000,
            });
          },
        },
        {
          provide: DATABASE,
          inject: [PG_POOL, LoggerService, ...(options.inject ?? [])],
          useFactory: async (pool: Pool, logger: LoggerService, ...args: never[]) => {
            const config = await options.useFactory(...args);

            return drizzle({
              client: pool,
              ...(config.jit === undefined ? {} : { jit: config.jit }),
              // `schema` is gone in v1 — relations replace it, and this service defines none.
              logger:
                config.logQueries === false
                  ? undefined
                  : new QueryLogger(logger.forContext('Query'), { params: config.logQueryParams }),
            });
          },
        },
      ],
      exports: [DATABASE, PG_POOL],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
