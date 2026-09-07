import { Module } from '@nestjs/common';
import { ConfigModule } from '@sklv-labs/nestjs-config';

import { ConfigService, validationSchema } from './config';
import { DrizzleModule } from './db';
import { HealthModule } from './health/health.module';
import { ClsModule } from './shared/cls';
import { HttpModule } from './shared/http';
import { LoggerModule } from './shared/logger';
import { logger } from './shared/logger/instance';
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
