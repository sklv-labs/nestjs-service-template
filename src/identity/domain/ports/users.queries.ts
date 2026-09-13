import type { AuthMethodSummary, CurrentUser, UserListItem } from '../read-models';
import type { UserId } from '../value-objects/user-id';

export type ListUsersParams = {
  offset: number;
  limit: number;
  search?: string;
  sort: string;
};

/**
 * The read side. Projections, never aggregates.
 *
 * Reads have no invariants to protect, so reconstructing an aggregate to render a list is pure
 * cost — and these may join across aggregates, which the write side may not.
 */
export abstract class UsersQueries {
  abstract list(params: ListUsersParams): Promise<{ items: UserListItem[]; total: number }>;

  abstract byId(id: UserId): Promise<CurrentUser | null>;

  abstract methodsOf(id: UserId): Promise<AuthMethodSummary[]>;
}
