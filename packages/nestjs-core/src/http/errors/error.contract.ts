import { z } from 'zod';

import type { BusinessErrorShape } from '../../errors';
import { reasonsOf } from '../../errors';

/** The error envelope every failure is rendered as. */
export const errorResponse = z
  .object({
    statusCode: z.number().int().describe('HTTP status code'),
    message: z.union([z.string(), z.array(z.string())]).describe('Human-readable explanation'),
    error: z.string().optional().describe('HTTP status text'),
    errorCode: z.string().optional().describe('Stable machine-readable code to branch on'),
    requestId: z.string().optional().describe('Correlates this response with the server logs'),
  })
  .meta({ id: 'ApiError' });

export type ErrorResponse = z.infer<typeof errorResponse>;

/** Renders a business error as its response contract, for documentation. */
export const businessErrorResponse = (status: number, error: BusinessErrorShape) =>
  errorResponse
    .extend({
      statusCode: z.literal(status),
      errorCode: z.literal(error.code),
      reason: z.enum(reasonsOf(error)).describe('Which of the cases behind this code occurred'),
      details: error.details,
    })
    // `.extend()` produces a new schema with no id, which OpenAPI then inlines at every endpoint
    // that documents this error. Naming it after the code gives one reusable component instead.
    .meta({ id: error.code });

/**
 * One documented example per reason, built from the messages on the error declaration, rather than
 * a near-identical hand-written block per reason kept in sync with the domain by hand.
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
