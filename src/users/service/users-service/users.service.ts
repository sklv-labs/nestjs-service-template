import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import type { ListUsersQuery, UserId } from '../../contracts';
import { USER_NOT_FOUND, USER_REGISTRATION_FAILED } from '../../contracts';
import type { UserSelect } from '../../domain/schemas';
import { UsersRepository } from '../abstracts';

import type { CreateUserProps } from './types';

const BLOCKED_DOMAINS = new Set(['blocked.example']);

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly users: UsersRepository) {}

  async getById(id: UserId): Promise<UserSelect> {
    const user = await this.users.findById(id);

    if (!user) {
      throw new NotFoundException(`User ${id} not found`, { errorCode: USER_NOT_FOUND });
    }

    return user;
  }

  list(query: ListUsersQuery): Promise<{ rows: UserSelect[]; total: number }> {
    return this.users.list({
      offset: (query.page - 1) * query.limit,
      limit: query.limit,
      search: query.search,
      sort: query.sort,
    });
  }

  /**
   * Business rules live here, not in the schema. The contract answers "is this structurally
   * valid data"; whether the operation is *allowed* is this layer's question.
   */
  async create(props: CreateUserProps): Promise<UserSelect> {
    const domain = props.email.split('@')[1] ?? '';

    if (BLOCKED_DOMAINS.has(domain)) {
      throw new ConflictException(
        {
          statusCode: 409,
          message: 'Registrations from this email domain are not accepted',
          error: 'Conflict',
          errorCode: USER_REGISTRATION_FAILED,
          reason: 'EMAIL_DOMAIN_BLOCKED',
          details: { email: props.email },
        },
        { errorCode: USER_REGISTRATION_FAILED },
      );
    }

    if (await this.users.findByEmail(props.email)) {
      throw new ConflictException(
        {
          statusCode: 409,
          message: 'A user with this email already exists',
          error: 'Conflict',
          errorCode: USER_REGISTRATION_FAILED,
          reason: 'EMAIL_ALREADY_REGISTERED',
          details: { email: props.email },
        },
        { errorCode: USER_REGISTRATION_FAILED },
      );
    }

    const user = await this.users.create({
      email: props.email,
      passwordHash: props.passwordHash,
    });

    this.logger.log(`Created user ${user.id}`);

    return user;
  }
}
