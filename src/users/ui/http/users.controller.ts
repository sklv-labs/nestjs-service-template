import { Controller, Get, HttpCode, Logger, Post, SerializeOptions } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { offsetOf } from '../../../shared/contracts';
import type { BodyOf, HeadersOf, ParamsOf, QueryOf } from '../../../shared/http';
import { ApiEndpoint, ReqBody, ReqHeaders, ReqParams, ReqQuery } from '../../../shared/http';
import { UsersService } from '../../service/users.service';

import { createUser, getUser, listUsers } from './endpoints';
import { toUserResponse, userListResponse, userResponse } from './responses';

/**
 * Each handler names its endpoint once. The decorators, the parameter schemas, the handler types
 * and the OpenAPI document all come from that descriptor, so none of them can drift apart.
 */
@ApiTags('Users')
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly users: UsersService) {}

  @Post()
  @HttpCode(201)
  @ApiEndpoint(createUser)
  @SerializeOptions({ schema: userResponse })
  async create(
    @ReqBody(createUser) body: BodyOf<typeof createUser>,
    @ReqHeaders(createUser) headers: HeadersOf<typeof createUser>,
  ) {
    this.logger.log(`Registering ${body.email} (request ${headers['x-request-id'] ?? 'none'})`);

    // Hashing is a placeholder — see the open questions in the README.
    const user = await this.users.create({ email: body.email, passwordHash: body.password });

    return toUserResponse(user);
  }

  @Get()
  @ApiEndpoint(listUsers)
  @SerializeOptions({ schema: userListResponse })
  async list(@ReqQuery(listUsers) query: QueryOf<typeof listUsers>) {
    const { rows, total } = await this.users.list({
      offset: offsetOf(query),
      limit: query.limit,
      search: query.search,
      sort: query.sort,
    });

    return {
      items: rows.map(toUserResponse),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  @Get(':id')
  @ApiEndpoint(getUser)
  @SerializeOptions({ schema: userResponse })
  async getById(@ReqParams(getUser) { id }: ParamsOf<typeof getUser>) {
    return toUserResponse(await this.users.getById(id));
  }
}
