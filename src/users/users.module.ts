import { Module } from '@nestjs/common';

import { UsersRepository } from './service/users.repository';
import { InMemoryUsersRepository } from './service/users.repository.memory';
import { UsersService } from './service/users.service';
import { UsersController } from './ui/http/users.controller';

@Module({
  controllers: [UsersController],
  providers: [
    // Swap for a drizzle adapter to run against Postgres — same port, one line.
    { provide: UsersRepository, useClass: InMemoryUsersRepository },
    UsersService,
  ],
})
export class UsersModule {}
