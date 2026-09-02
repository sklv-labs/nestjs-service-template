import { Injectable } from '@nestjs/common';

import type { Handler } from '../../shared/operation';
import type { UserId, UserRow } from '../domain';
import { UsersService } from '../service/users.service';

export type GetUserInput = { id: UserId };
export type GetUserOutput = { user: UserRow };

@Injectable()
export class GetUserHandler implements Handler<GetUserInput, GetUserOutput> {
  constructor(private readonly users: UsersService) {}

  async execute(input: GetUserInput): Promise<GetUserOutput> {
    return { user: await this.users.getById(input.id) };
  }
}
