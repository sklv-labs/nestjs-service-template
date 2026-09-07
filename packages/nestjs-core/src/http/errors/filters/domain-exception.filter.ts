import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { Context, InjectContext } from '../../../context';
import { DomainError } from '../../../errors';
import type { Logger } from '../../../logger';
import { InjectLogger } from '../../../logger';
import { contractForError } from '../error.registry';

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
  @InjectLogger() private readonly logger: Logger;
  @InjectContext() private readonly context: Context;

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: DomainError, host: ArgumentsHost): void {
    const contract = contractForError(exception.code);
    const status = contract?.status;

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

    const body = {
      statusCode,
      message: exception.message,
      errorCode: exception.code,
      reason: exception.reason,
      details: exception.details,
      // Every error contract documents this field; before this it documented one nothing ever sent.
      requestId: this.context.id,
    };

    // Exception filters run outside the interceptor chain, so `StandardSchemaSerializerInterceptor`
    // never sees this response — and could not serialize it anyway, because `@SerializeOptions`
    // carries the handler's *success* schema. Parsing here is what gives error responses the same
    // guarantee success responses get: the contract decides what goes out, and unknown keys are
    // stripped rather than trusted.
    //
    // A parse failure means the filter and the endpoint's declared schema have drifted, which is a
    // bug in us rather than in the caller — so it is logged loudly and the unparsed body still goes
    // out, because returning nothing would turn our bug into their outage.
    const parsed = contract?.schema.safeParse(body);

    if (parsed && !parsed.success) {
      this.logger.error(
        { errorCode: exception.code, issues: parsed.error.issues },
        'Error response does not satisfy its documented contract',
      );
    }

    this.adapterHost.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      parsed?.success ? parsed.data : body,
      statusCode,
    );
  }
}
