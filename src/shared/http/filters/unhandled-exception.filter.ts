import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { InjectRequestContext, RequestContext } from '../../cls';
import type { Logger } from '../../logger';
import { InjectLogger } from '../../logger';

/**
 * The last resort. Anything arriving here is a bug — an unexpected throw, or a response that failed
 * its own contract in the serializer.
 *
 * Two jobs. Log the real cause with its stack, because this is the only place it exists. And return
 * a body that reveals nothing about internals: no stack, no driver message, no SQL — only the
 * correlation id, which is what turns "it broke" into a line in the logs.
 *
 * `HttpException` passes through untouched, so validation failures keep the shape Nest gives them.
 */
@Catch()
export class UnhandledExceptionFilter implements ExceptionFilter {
  @InjectLogger() private readonly logger: Logger;
  @InjectRequestContext() private readonly context: RequestContext;

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof HttpException) {
      this.adapterHost.httpAdapter.reply(response, exception.getResponse(), exception.getStatus());
      return;
    }

    this.logger.error(exception instanceof Error ? exception : new Error(String(exception)));

    this.adapterHost.httpAdapter.reply(
      response,
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        requestId: this.context.id,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
