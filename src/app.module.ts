import { Module } from '@nestjs/common';
import { ConfigModule } from '@sklv-labs/nestjs-config';

import { ConfigService, validationSchema } from './config';
import { logger } from './logger';
import { DrizzleModule } from './db';
import { HealthModule } from './health/health.module';
import { ClsModule } from './shared/cls';
import { HttpModule } from './shared/http';
import { LoggerModule } from './shared/logger';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ validationSchema, providers: [ConfigService] }),
    // Before everything else: the correlation context is what the logger and filters read.
    ClsModule.forRoot(),
    // The instance is built in ./logger, because Fastify needs it before Nest exists.
    LoggerModule.forRoot({ instance: logger }),
    HttpModule,
    DrizzleModule,
    HealthModule,
    UsersModule,
  ],
})
export class AppModule {}
