import { Injectable } from '@nestjs/common';
import type { Handler } from '@sklv-labs/nestjs-core/operation';

import { UserNotFound } from '../domain/errors';
import { UsersQueries } from '../domain/ports';
import type { CurrentUser } from '../domain/read-models';
import type { UserId } from '../domain/value-objects/user-id';

export type GetUserInput = { id: UserId };
export type GetUserOutput = { user: CurrentUser };

/** A read: straight to a projection, with no aggregate reconstructed. */
@Injectable()
export class GetUserHandler implements Handler<GetUserInput, GetUserOutput> {
  constructor(private readonly users: UsersQueries) {}

  async execute(input: GetUserInput): Promise<GetUserOutput> {
    const user = await this.users.byId(input.id);

    if (!user) {
      throw UserNotFound.raise('BY_ID', { id: input.id });
    }

    return { user };
  }
}
