import { Injectable } from '@nestjs/common';
import { Transactional } from '@sklv-labs/nestjs-core/database';
import type { Logger } from '@sklv-labs/nestjs-core/logger';
import { InjectLogger } from '@sklv-labs/nestjs-core/logger';
import type { Handler } from '@sklv-labs/nestjs-core/operation';

import { User } from '../domain/entities';
import { UserRegistrationFailed } from '../domain/errors';
import { Clock, PasswordHasher, UsersRepository } from '../domain/ports';
import type { CurrentUser } from '../domain/read-models';
import { Email } from '../domain/value-objects/email';
import { UserId } from '../domain/value-objects/user-id';

export type RegisterUserInput = {
  email: string;
  password: string;
};

export type RegisterUserOutput = {
  user: CurrentUser;
};

const BLOCKED_DOMAINS = new Set(['blocked.example']);

/**
 * Creates an account with a password.
 *
 * The rules split between two places, and the split is the point: "at least one sign-in method"
 * lives on the aggregate because it is about the aggregate's own state, while "this address is
 * taken" lives here because answering it needs a port.
 */
@Injectable()
export class RegisterUserHandler implements Handler<RegisterUserInput, RegisterUserOutput> {
  @InjectLogger() private readonly logger: Logger;

  constructor(
    private readonly users: UsersRepository,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  @Transactional()
  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    const email = Email.of(input.email);
    const domain = email.split('@')[1] ?? '';

    if (BLOCKED_DOMAINS.has(domain)) {
      throw UserRegistrationFailed.raise('EMAIL_DOMAIN_BLOCKED', { email });
    }

    if (await this.users.findByEmail(email)) {
      throw UserRegistrationFailed.raise('EMAIL_ALREADY_REGISTERED', { email });
    }

    const now = this.clock.now();
    const user = User.register({ id: UserId.next(), email, now });

    user.setPassword(await this.hasher.hash(input.password), now);

    await this.users.save(user);

    this.logger.log({ userId: user.id }, 'Registered user');

    // A projection, not the snapshot: the snapshot carries the password hash, and handing it to
    // the transport would put the hash one careless mapper away from a response body.
    return {
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerifiedAt !== null,
        status: user.status,
        createdAt: user.createdAt,
      },
    };
  }
}
