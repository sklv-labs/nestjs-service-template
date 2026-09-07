import { Module } from '@nestjs/common';
import { ConfigModule } from '@sklv-labs/nestjs-config';

import { ConfigService, validationSchema } from './config';
import { DrizzleModule } from './db';
import { HealthModule } from './health/health.module';
import { ClsModule } from '@sklv-labs/nestjs-core/cls';
import { HttpModule } from '@sklv-labs/nestjs-core/http';
import { LoggerModule } from '@sklv-labs/nestjs-core/logger';
import { logger } from './config/logger';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ validationSchema, providers: [ConfigService] }),
    ClsModule.forRoot(),
    LoggerModule.forRoot({ instance: logger }),
    HttpModule,
    DrizzleModule,
    HealthModule,
    UsersModule,
  ],
})
export class AppModule {}
