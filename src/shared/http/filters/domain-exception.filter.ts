import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { DomainError } from '../../errors';
import type { ContextLogger } from '../../logger';
import { InjectLogger } from '../../logger';
import { statusForError } from '../error-status';

/**
 * Renders a business failure as its documented HTTP response.
 *
 * Scoped to `DomainError` rather than catching everything, so Nest's own `HttpException` handling
 * and the last-resort filter still apply. A catch-all here would silently take over every error in
 * the application, which is what the previous version did.
 *
 * Replies through `HttpAdapterHost` so nothing here knows which HTTP adapter is underneath.
 */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  @InjectLogger() private readonly logger!: ContextLogger;

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: DomainError, host: ArgumentsHost): void {
    const status = statusForError(exception.code);

    if (status === undefined) {
      // A wiring bug: the domain can raise this, but no endpoint documents it.
      this.logger.error(
        { errorCode: exception.code, reason: exception.reason },
        `No HTTP status mapped for ${exception.code}; returning 500`,
      );
    }

    const statusCode = status ?? HttpStatus.INTERNAL_SERVER_ERROR;

    // A 409 is the system working as designed, not an incident. Logging expected failures at warn
    // is how an error log becomes noise nobody reads.
    this.logger.debug(
      { errorCode: exception.code, reason: exception.reason, statusCode },
      exception.message,
    );

    this.adapterHost.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      {
        statusCode,
        message: exception.message,
        errorCode: exception.code,
        reason: exception.reason,
        details: exception.details,
      },
      statusCode,
    );
  }
}
