import { Injectable } from '@nestjs/common';

import type { ContextLogger } from '../../shared/logger';
import { Logger } from '../../shared/logger';
import type { UserId, UserRow } from '../domain';
import { UserNotFound, UserRegistrationFailed } from '../domain';

import type { ListUsersParams } from './users.repository';
import { UsersRepository } from './users.repository';

const BLOCKED_DOMAINS = new Set(['blocked.example']);

@Injectable()
export class UsersService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly users: UsersRepository,
    logger: Logger,
  ) {
    // Bound in the constructor rather than a field initialiser: a field cannot read a constructor
    // parameter before the constructor runs.
    this.logger = logger.forContext(UsersService.name);
  }

  async getById(id: UserId): Promise<UserRow> {
    const user = await this.users.findById(id);

    if (!user) {
      throw UserNotFound.raise('BY_ID', { id });
    }

    return user;
  }

  list(params: ListUsersParams): Promise<{ rows: UserRow[]; total: number }> {
    return this.users.list(params);
  }

  /**
   * Business rules live here. The contract already established that the data is well-formed;
   * whether the operation is allowed is this layer's question.
   */
  async create(props: { email: string; passwordHash: string }): Promise<UserRow> {
    const domain = props.email.split('@')[1] ?? '';

    if (BLOCKED_DOMAINS.has(domain)) {
      throw UserRegistrationFailed.raise('EMAIL_DOMAIN_BLOCKED', { email: props.email });
    }

    if (await this.users.findByEmail(props.email)) {
      throw UserRegistrationFailed.raise('EMAIL_ALREADY_REGISTERED', { email: props.email });
    }

    const user = await this.users.create(props);
    this.logger.log(`Created user ${user.id}`);

    return user;
  }
}
