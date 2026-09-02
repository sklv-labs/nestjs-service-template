import type { Uuid } from '@sklv-labs/core';
import { z } from 'zod';

/**
 * A UUID v7 contract whose inferred type is a branded id from `@sklv-labs/core`.
 *
 * The brand is applied by casting the schema, not by `.transform()`. That is deliberate:
 * zod cannot express a transform in JSON Schema, so a transformed schema throws when Nest
 * converts it for the *output* side of OpenAPI. A cast is type-only, so both the input and
 * output projections keep working while `z.infer` still yields `UserId` rather than `string`.
 */
export const brandedUuid = <T extends Uuid>() =>
  z.uuid({ version: 'v7' }) as unknown as z.ZodType<T, string>;
