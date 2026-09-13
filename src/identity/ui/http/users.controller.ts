import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { ParamsOf, QueryOf } from '@sklv-labs/nestjs-core/http';
import { ReqParams, ReqQuery, UseEndpoint } from '@sklv-labs/nestjs-core/http';

import { GetUserHandler, ListUsersHandler } from '../../operation';

import { getUser, listUsers } from './endpoints';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly getHandler: GetUserHandler,
    private readonly listHandler: ListUsersHandler,
  ) {}

  @Get()
  @UseEndpoint(listUsers)
  async list(@ReqQuery(listUsers) query: QueryOf<typeof listUsers>) {
    const output = await this.listHandler.execute(listUsers.toInput({ query }));

    return listUsers.toResponse(output);
  }

  @Get(':id')
  @UseEndpoint(getUser)
  async getById(@ReqParams(getUser) params: ParamsOf<typeof getUser>) {
    const output = await this.getHandler.execute(getUser.toInput({ params }));

    return getUser.toResponse(output);
  }
}
