import { Module } from '@nestjs/common';

import { Clock, PasswordHasher, UsersQueries, UsersRepository } from './domain/ports';
import { SystemClock } from './infrastructure/clock/system-clock';
import { Argon2PasswordHasher } from './infrastructure/hashing/argon2-password-hasher';
import { DrizzleUsersQueries } from './infrastructure/persistence/drizzle-users.queries';
import { DrizzleUsersRepository } from './infrastructure/persistence/drizzle-users.repository';
import { GetUserHandler, ListUsersHandler, RegisterUserHandler } from './operation';
import { AuthController } from './ui/http/auth.controller';
import { UsersController } from './ui/http/users.controller';

/**
 * Accounts and the ways they are signed into.
 *
 * Ports are bound to adapters here and nowhere else — every consumer depends on the abstract
 * class, which is both the type and the injection token.
 */
@Module({
  controllers: [AuthController, UsersController],
  providers: [
    { provide: UsersRepository, useClass: DrizzleUsersRepository },
    { provide: UsersQueries, useClass: DrizzleUsersQueries },
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
    { provide: Clock, useClass: SystemClock },
    RegisterUserHandler,
    GetUserHandler,
    ListUsersHandler,
  ],
})
export class IdentityModule {}
