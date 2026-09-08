import { Module } from '@nestjs/common';
import { ConfigModule } from '@sklv-labs/nestjs-config';

import { ConfigService, validationSchema } from './config';
import { appContext } from './config/context';
import { DrizzleModule } from './db';
import { HealthModule } from './health/health.module';
import { Context, ContextModule } from '@sklv-labs/nestjs-core/context';
import { HttpModule } from '@sklv-labs/nestjs-core/http';
import { LoggerModule } from '@sklv-labs/nestjs-core/logger';
import { logger } from './config/logger';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ validationSchema, providers: [ConfigService] }),
    ContextModule.forRoot({ registry: appContext }),
    LoggerModule.forRoot({ instance: logger, context: Context }),
    HttpModule,
    DrizzleModule,
    HealthModule,
    UsersModule,
  ],
})
export class AppModule {}
