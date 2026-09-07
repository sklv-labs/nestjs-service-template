import { Module } from '@nestjs/common';
import { APP_FILTER, DiscoveryModule } from '@nestjs/core';

import { EndpointScanner } from './endpoint';
import { DomainExceptionFilter, UnhandledExceptionFilter } from './errors';

/**
 * Registers the exception filters through DI, so they can inject the logger and the adapter host
 * rather than being constructed by hand in `main.ts`.
 *
 * Order matters: Nest evaluates global filters last-registered-first, so the catch-all is declared
 * before the specific one.
 */
@Module({
  imports: [DiscoveryModule],
  providers: [
    EndpointScanner,
    { provide: APP_FILTER, useClass: UnhandledExceptionFilter },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class HttpModule {}
