import { Injectable } from '@nestjs/common';

import type { Logger } from '../../shared/logger';
import { InjectLogger } from '../../shared/logger';
import type { Handler } from '../../shared/operation';
import type { UserRow } from '../domain';
import { UsersService } from '../service/users.service';

export type CreateUserInput = {
  email: string;
  password: string;
  /** Carried through for logs and events. Every transport can supply one. */
  correlationId?: string;
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
    this.logger.log(`Registering ${input.email} (correlation ${input.correlationId ?? 'none'})`);

    // Hashing is a placeholder — see the open questions in the README.
    const user = await this.users.create({ email: input.email, passwordHash: input.password });

    return { user };
  }
}
