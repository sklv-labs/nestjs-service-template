import { Module } from '@nestjs/common';
import { ConfigModule } from '@sklv-labs/nestjs-config';

import { ConfigService, validationSchema } from './config';
import { appContext } from './config/context';
import { HealthModule } from './health/health.module';
import { Context, ContextModule } from '@sklv-labs/nestjs-core/context';
import { DatabaseModule, drizzleTransactionPlugin } from '@sklv-labs/nestjs-core/database';
import { HttpModule } from '@sklv-labs/nestjs-core/http';
import { LoggerModule } from '@sklv-labs/nestjs-core/logger';
import { logger } from './config/logger';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ validationSchema, providers: [ConfigService] }),
    ContextModule.forRoot({
      registry: appContext,
      // The transaction lives exactly as long as the unit of work the context defines, so it runs
      // on the same async local storage rather than a second one.
      plugins: [drizzleTransactionPlugin()],
    }),
    LoggerModule.forRoot({ instance: logger, context: Context }),
    HttpModule,
    DatabaseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.database,
    }),
    HealthModule,
    UsersModule,
  ],
})
export class AppModule {}
