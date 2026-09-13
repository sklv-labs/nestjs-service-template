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
import { IdentityModule } from './identity/identity.module';

@Module({
  imports: [
    ConfigModule.forRoot({ validationSchema, providers: [ConfigService] }),
    ContextModule.forRoot({
      registry: appContext,
      plugins: [drizzleTransactionPlugin()],
    }),
    LoggerModule.forRoot({ instance: logger, context: Context }),
    HttpModule,
    DatabaseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.database,
    }),
    HealthModule,
    IdentityModule,
  ],
})
export class AppModule {}
