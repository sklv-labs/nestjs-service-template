import { Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import type { BodyOf, HeadersOf, ParamsOf, QueryOf } from '../../../shared/http';
import { ReqBody, ReqHeaders, ReqParams, ReqQuery, UseEndpoint } from '../../../shared/http';
import { CreateUserHandler, GetUserHandler, ListUsersHandler } from '../../operation';

import { createUser, getUser, listUsers } from './endpoints';

/**
 * The HTTP transport. Each handler does exactly three things: validate through the endpoint's
 * contracts, translate the request into the operation's input, and translate the output back.
 *
 * There is no business logic here and no shape-juggling — both translations live in the endpoint
 * descriptor, so an RMQ consumer driving the same operations repeats none of it.
 */
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly createUserHandler: CreateUserHandler,
    private readonly getUserHandler: GetUserHandler,
    private readonly listUsersHandler: ListUsersHandler,
  ) {}

  @Post()
  @UseEndpoint(createUser)
  async create(
    @ReqBody(createUser) body: BodyOf<typeof createUser>,
    @ReqHeaders(createUser) headers: HeadersOf<typeof createUser>,
  ) {
    const output = await this.createUserHandler.execute(createUser.toInput({ body, headers }));

    return createUser.toResponse(output);
  }

  @Get()
  @UseEndpoint(listUsers)
  async list(@ReqQuery(listUsers) query: QueryOf<typeof listUsers>) {
    const output = await this.listUsersHandler.execute(listUsers.toInput({ query }));

    return listUsers.toResponse(output);
  }

  @Get(':id')
  @UseEndpoint(getUser)
  async getById(@ReqParams(getUser) params: ParamsOf<typeof getUser>) {
    const output = await this.getUserHandler.execute(getUser.toInput({ params }));

    return getUser.toResponse(output);
  }
}
