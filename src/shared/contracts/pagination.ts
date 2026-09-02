import { z } from 'zod';

import { int } from './fields';

export const pageQuery = {
  page: int('1-based page number', { min: 1 }).default(1),
  limit: int('Items per page, max 100', { min: 1, max: 100 }).default(20),
};

export type PageQuery = z.infer<z.ZodObject<typeof pageQuery>>;

/** Wraps an item contract in a page envelope, so `Paginated<User>` composes at the type level. */
export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    meta: z.object({
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
    }),
  });

export const offsetOf = (query: PageQuery) => (query.page - 1) * query.limit;
