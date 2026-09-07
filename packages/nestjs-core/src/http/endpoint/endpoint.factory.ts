import { z } from 'zod';

import type { BusinessErrorShape } from '../../errors';
import { businessErrorExamples, businessErrorResponse, errorResponse } from '../errors';

import type { Endpoint, RequestSpec, ResponseSpec } from './endpoint.types';

/**
 * Describes one endpoint: what a request may carry, how it maps onto an operation, what success
 * looks like, and every way it can fail. Decorators, parameter schemas, handler types and the
 * OpenAPI document all derive from this single value.
 */
export const endpoint = <const R extends RequestSpec, S extends z.ZodObject, Input, Output>(
  def: Endpoint<R, S, Input, Output>,
): Endpoint<R, S, Input, Output> => def;

/** A transport-level failure with no business meaning — validation, auth, a missing route. */
export const failure = (status: number, description: string): ResponseSpec => ({
  status,
  description,
  schema: errorResponse,
});

/**
 * A business error response. Generates one example per reason from the messages on the error
 * declaration, and carries the code so the boot scan can map it to this status — no import-time
 * side effect and no global mutation at module load.
 */
export const httpError = <D extends z.ZodType>(
  status: number,
  error: BusinessErrorShape<D>,
  detailsExample: z.input<D>,
  description?: string,
): ResponseSpec => ({
  status,
  description: description ?? error.code,
  schema: businessErrorResponse(status, error),
  examples: businessErrorExamples(status, error, detailsExample),
  errorCode: error.code,
});
