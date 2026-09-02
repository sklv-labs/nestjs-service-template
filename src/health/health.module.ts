import { Controller, Get, Inject, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TerminusModule } from '@nestjs/terminus';
import { Pool } from 'pg';

import { PG_POOL } from '../db';

@ApiTags('Health')
@Controller('health')
class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      async () => {
        try {
          await this.pool.query('select 1');
          return { database: { status: 'up' as const } };
        } catch (error) {
          return {
            database: { status: 'down' as const, message: (error as Error).message },
          };
        }
      },
    ]);
  }
}

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
