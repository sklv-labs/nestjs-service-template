import type { NewUserRow, UserId, UserRow } from '../domain';

export type ListUsersParams = {
  offset: number;
  limit: number;
  search?: string;
  sort: string;
};

/** The port. An abstract class so it is also the DI token. */
export abstract class UsersRepository {
  abstract findById(id: UserId): Promise<UserRow | null>;

  abstract findByEmail(email: string): Promise<UserRow | null>;

  abstract list(params: ListUsersParams): Promise<{ rows: UserRow[]; total: number }>;

  abstract create(user: NewUserRow): Promise<UserRow>;
}
