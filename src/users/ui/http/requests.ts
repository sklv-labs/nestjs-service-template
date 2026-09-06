import { email, id, int, oneOf, str } from '../../../shared/contracts';
import { req } from '../../../shared/http';
import type { UserId } from '../../domain';

/**
 * The request contracts for this feature, named and defined apart from the endpoints that use
 * them — mirroring `responses.ts`.
 *
 * An endpoint then reads as wiring (what it accepts, what it returns, how it maps onto an
 * operation) rather than burying that under schema definitions. It also lets two endpoints share a
 * shape: `userIdParams` already serves any route addressing a single user.
 */

export const createUserBody = req.body({
  email: email("The user's primary email address", { example: 'alex@example.com' }),
  password: str('Plaintext password, at least 12 characters', {
    min: 12,
    max: 256,
    example: 'correct-horse-battery-staple',
  }),
});

export const userIdParams = req.params({
  id: id<UserId>('Identifier of the user', { example: '01930000-0000-7000-8000-000000000000' }),
});

export const listUsersQuery = req.query({
  page: int('1-based page number', { min: 1 }).default(1),
  limit: int('Items per page, max 100', { min: 1, max: 100 }).default(20),
  search: str('Case-insensitive match on email', { min: 1, max: 100 }).optional(),
  sort: oneOf(
    ['createdAt', '-createdAt', 'email', '-email'],
    'Sort field, prefixed with - for descending',
  ).default('-createdAt'),
});
