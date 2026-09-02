import { Module } from '@nestjs/common';

import { UsersRepository } from './abstracts';
import { DrizzleUsersRepository } from './users-repository';
import { UsersService } from './users-service';

@Module({
  providers: [{ provide: UsersRepository, useClass: DrizzleUsersRepository }, UsersService],
  exports: [UsersService],
})
export class ServiceModule {}
