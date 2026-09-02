import { z } from 'zod';

/**
 * Query parameters arrive as strings, so every numeric field needs `z.coerce`. Note that a
 * coerced field is documented as `integer` on the input side too — accurate for query strings,
 * but a small lie if you ever coerce inside a JSON body.
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('1-based page number'),
  limit: z.coerce.number().int().min(1).max(100).default(20).describe('Items per page, max 100'),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/** Wraps an item contract in a page envelope. Composes at the type level: `Paginated<User>`. */
export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    meta: z.object({
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
    }),
  });
