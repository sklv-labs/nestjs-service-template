import type { User } from '../entities';
import type { Email } from '../value-objects/email';
import type { UserId } from '../value-objects/user-id';

/**
 * The write side. Whole aggregates only.
 *
 * There is no `list`, no projection and no partial load here on purpose: a `findByIdWithoutMethods`
 * would make the aggregate's invariant unenforceable, and is almost always a read wearing a
 * write's clothes. Reads go through {@link UsersQueries}.
 *
 * An abstract class rather than an interface, so it is its own DI token.
 */
export abstract class UsersRepository {
  abstract findById(id: UserId): Promise<User | null>;

  abstract findByEmail(email: Email): Promise<User | null>;

  /** Persists the whole aggregate in one transaction, and advances its version. */
  abstract save(user: User): Promise<void>;
}
