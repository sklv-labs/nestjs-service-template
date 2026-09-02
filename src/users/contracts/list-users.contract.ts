import { z } from 'zod';

import { PaginationQuerySchema } from '../../contracts';

export const ListUsersQuerySchema = PaginationQuerySchema.extend({
  search: z.string().min(1).max(100).optional().describe('Case-insensitive match on email'),
  sort: z
    .enum(['createdAt', '-createdAt', 'email', '-email'])
    .default('-createdAt')
    .describe('Sort field, prefixed with - for descending'),
});

export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>;
