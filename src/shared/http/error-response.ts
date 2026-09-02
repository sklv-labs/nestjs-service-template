import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';

import type { BusinessError } from '../errors';
import { isDomainError } from '../errors';

/** The error envelope, matching what Nest itself produces plus the business fields. */
export const errorResponse = z.object({
  statusCode: z.number().int().describe('HTTP status code'),
  message: z.union([z.string(), z.array(z.string())]).describe('Human-readable explanation'),
  error: z.string().optional().describe('HTTP status text'),
  errorCode: z.string().optional().describe('Stable machine-readable code to branch on'),
});

export type ErrorResponse = z.infer<typeof errorResponse>;

/** Renders a business error as its response contract, for documentation. */
export const businessErrorResponse = <
  Code extends string,
  Reasons extends readonly [string, ...string[]],
  Details extends z.ZodType,
>(
  status: number,
  error: BusinessError<Code, Reasons, Details>,
) =>
  errorResponse.extend({
    statusCode: z.literal(status),
    errorCode: z.literal(error.code),
    reason: z.enum(error.reasons).describe('Which of the cases behind this code occurred'),
    details: error.details,
  });

const statusByCode = new Map<string, number>();

/**
 * Declares which HTTP status a business error maps to. Called from `ui/http`, because the status
 * is a transport decision — the domain does not know it. `httpError()` in `endpoint.ts` registers
 * the mapping as a side effect of documenting the response, so the two cannot disagree.
 */
export const mapErrorStatus = (code: string, status: number): void => {
  statusByCode.set(code, status);
};

/**
 * Turns a `DomainError` into its HTTP response. Without this, a raised business error would
 * surface as a bare 500 — nothing else in the chain knows what a domain error is.
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

      const body = {
        statusCode: status ?? HttpStatus.INTERNAL_SERVER_ERROR,
        message: exception.message,
        errorCode: exception.code,
        reason: exception.reason,
        details: exception.details,
      };

      response.status(body.statusCode).json(body);
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
