import { Injectable } from '@nestjs/common';

import type { Logger } from '@sklv-labs/nestjs-core/logger';
import { InjectLogger } from '@sklv-labs/nestjs-core/logger';
import type { Handler } from '@sklv-labs/nestjs-core/operation';
import type { UserRow } from '../domain';
import { UsersService } from '../service/users.service';

export type CreateUserInput = {
  email: string;
  password: string;
};

export type CreateUserOutput = {
  user: UserRow;
};

/**
 * Registers a user.
 *
 * Thin today, because registering is one service call. It is still the right seam: sending a
 * welcome email, publishing a `UserRegistered` event or provisioning a workspace all belong here,
 * and none of them belong in a controller or in `UsersService`.
 */
@Injectable()
export class CreateUserHandler implements Handler<CreateUserInput, CreateUserOutput> {
  @InjectLogger() private readonly logger: Logger;

  constructor(private readonly users: UsersService) {}

  async execute(input: CreateUserInput): Promise<CreateUserOutput> {
    // No correlation id is threaded through the input: every line this logger writes already
    // carries the context's fields, and interpolating one into the message duplicates it as text
    // nothing can query.
    this.logger.log({ email: input.email }, 'Registering user');

    // Hashing is a placeholder — see the open questions in the README.
    const user = await this.users.create({ email: input.email, passwordHash: input.password });

    return { user };
  }
}
