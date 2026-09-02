import { Module } from '@nestjs/common';

import { UsersRepository } from './abstracts';
import { InMemoryUsersRepository } from './in-memory-repository';
import { UsersService } from './users-service';

@Module({
  providers: [
    // Swap for DrizzleUsersRepository to run against Postgres — same port, one line.
    { provide: UsersRepository, useClass: InMemoryUsersRepository },
    UsersService,
  ],
  exports: [UsersService],
})
export class ServiceModule {}
