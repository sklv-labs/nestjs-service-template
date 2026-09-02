import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import type { UserId, UserSelect } from '../../domain/schemas';
import { UsersRepository } from '../abstracts';

import type { CreateUserProps } from './types';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly users: UsersRepository) {}

  async getById(id: UserId): Promise<UserSelect> {
    const user = await this.users.findById(id);

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  async getByEmail(email: string): Promise<UserSelect> {
    const user = await this.users.findByEmail(email);

    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    return user;
  }

  async create(props: CreateUserProps): Promise<UserSelect> {
    if (await this.users.findByEmail(props.email)) {
      throw new ConflictException(`User with email ${props.email} already exists`);
    }

    const user = await this.users.create(props);
    this.logger.log(`Created user ${user.id}`);

    return user;
  }
}
