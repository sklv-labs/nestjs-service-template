import { Module } from '@nestjs/common';
import { ConfigModule } from '@sklv-labs/nestjs-config';

import { ConfigService, validationSchema } from './config';
import { DrizzleModule } from './db';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ validationSchema, providers: [ConfigService] }),
    DrizzleModule,
    HealthModule,
    UsersModule,
  ],
})
export class AppModule {}
