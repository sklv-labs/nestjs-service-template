import type { UserId } from '../../contracts';
import type { UserInsert, UserSelect } from '../../domain/schemas';

/**
 * The port the service layer depends on. Returns persistence rows, not response contracts —
 * mapping to the transport shape is the ui layer's job.
 */
export abstract class UsersRepository {
  abstract findById(id: UserId): Promise<UserSelect | null>;

  abstract findByEmail(email: string): Promise<UserSelect | null>;

  abstract list(params: {
    offset: number;
    limit: number;
    search?: string;
    sort: string;
  }): Promise<{ rows: UserSelect[]; total: number }>;

  abstract create(user: UserInsert): Promise<UserSelect>;
}
