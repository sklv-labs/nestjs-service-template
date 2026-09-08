import { Module } from '@nestjs/common';

import { CreateUserHandler, GetUserHandler, ListUsersHandler } from './operation';
import { UsersRepository } from './service/users.repository';
import { DrizzleUsersRepository } from './service/users.repository.drizzle';
import { UsersService } from './service/users.service';
import { UsersController } from './ui/http/users.controller';

@Module({
  controllers: [UsersController],
  providers: [
    // Swap for a drizzle adapter to run against Postgres — same port, one line.
    { provide: UsersRepository, useClass: DrizzleUsersRepository },
    UsersService,
    CreateUserHandler,
    GetUserHandler,
    ListUsersHandler,
  ],
})
export class UsersModule {}
