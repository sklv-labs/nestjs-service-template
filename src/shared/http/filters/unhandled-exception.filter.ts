import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { Logger } from '../../logger';

/**
 * The last resort. Anything arriving here is a bug — an unexpected throw, or a response that failed
 * its own contract in the serializer.
 *
 * Two jobs. Log the real cause with its stack, because this is the only place it exists. And return
 * a body that reveals nothing about internals: no stack, no driver message, no SQL. The correlation
 * id is already on the response as a header, so a user can quote it without it being in the body.
 *
 * `HttpException` passes through untouched, so validation failures keep the shape Nest gives them.
 */
@Catch()
export class UnhandledExceptionFilter implements ExceptionFilter {
  private readonly logger;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    rootLogger: Logger,
  ) {
    this.logger = rootLogger.forContext(UnhandledExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof HttpException) {
      this.adapterHost.httpAdapter.reply(response, exception.getResponse(), exception.getStatus());
      return;
    }

    this.logger.error(exception instanceof Error ? exception : new Error(String(exception)));

    this.adapterHost.httpAdapter.reply(
      response,
      { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
