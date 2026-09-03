import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';

import type { BusinessErrorShape } from '../errors';
import { isDomainError, reasonsOf } from '../errors';

/** The error envelope, matching what Nest itself produces plus the business fields. */
export const errorResponse = z.object({
  statusCode: z.number().int().describe('HTTP status code'),
  message: z.union([z.string(), z.array(z.string())]).describe('Human-readable explanation'),
  error: z.string().optional().describe('HTTP status text'),
  errorCode: z.string().optional().describe('Stable machine-readable code to branch on'),
});

export type ErrorResponse = z.infer<typeof errorResponse>;

/** Renders a business error as its response contract, for documentation. */
export const businessErrorResponse = (status: number, error: BusinessErrorShape) =>
  errorResponse.extend({
    statusCode: z.literal(status),
    errorCode: z.literal(error.code),
    reason: z.enum(reasonsOf(error)).describe('Which of the cases behind this code occurred'),
    details: error.details,
  });

/**
 * One documented example per reason, built from the messages on the error declaration. The
 * alternative is hand-writing a near-identical block per reason and keeping the messages in sync
 * with the domain by hand.
 */
export const businessErrorExamples = (
  status: number,
  error: BusinessErrorShape,
  details: unknown,
): Record<string, { summary: string; value: unknown }> =>
  Object.fromEntries(
    Object.entries(error.reasons).map(([reason, message]) => [
      reason,
      {
        summary: message,
        value: { statusCode: status, message, errorCode: error.code, reason, details },
      },
    ]),
  );

const statusByCode = new Map<string, number>();

/**
 * Declares which HTTP status a business error maps to. Called from `ui/http`, because the status is
 * a transport decision. `httpError()` registers it while documenting the response, so the
 * documented status and the one the filter returns cannot disagree.
 *
 * The weakness: an error whose endpoint never calls `httpError()` has no entry, and the filter
 * degrades it to a 500 with a logged warning rather than failing loudly.
 */
export const mapErrorStatus = (code: string, status: number): void => {
  statusByCode.set(code, status);
};

/**
 * Turns a `DomainError` into its HTTP response. Without this a raised business error would surface
 * as a bare 500 — nothing else in the chain knows what a domain error is.
 */
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (isDomainError(exception)) {
      const status = statusByCode.get(exception.code);

      if (status === undefined) {
        // An unmapped code is a wiring bug: the domain can raise it but no endpoint documents it.
        this.logger.error(
          `No HTTP status mapped for business error ${exception.code}; returning 500`,
        );
      }

      const statusCode = status ?? HttpStatus.INTERNAL_SERVER_ERROR;

      response.status(statusCode).json({
        statusCode,
        message: exception.message,
        errorCode: exception.code,
        reason: exception.reason,
        details: exception.details,
      });
      return;
    }

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    this.logger.error(exception);
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ statusCode: 500, message: 'Internal server error' });
  }
}
