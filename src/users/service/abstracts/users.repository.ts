import type { UserId, UserInsert, UserSelect } from '../../domain/schemas';

/**
 * The port the service layer depends on. Injected as a class token, so swapping the drizzle
 * adapter for a fake in tests needs no interface symbol.
 */
export abstract class UsersRepository {
  abstract findById(id: UserId): Promise<UserSelect | null>;

  abstract findByEmail(email: string): Promise<UserSelect | null>;

  abstract create(user: UserInsert): Promise<UserSelect>;
}
