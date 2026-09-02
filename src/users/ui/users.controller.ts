import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  SerializeOptions,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ApiErrorSchema, openApiSchema } from '../../contracts';
import {
  CreateUserRequestSchema,
  createUserExamples,
  ListUsersQuerySchema,
  UserIdSchema,
  UserListResponseSchema,
  UserRegistrationFailedSchema,
  UserResponseSchema,
  userErrorExamples,
  userResponseExamples,
} from '../contracts';
import type { CreateUserRequest, ListUsersQuery, UserId, UserResponse } from '../contracts';
import type { UserSelect } from '../domain/schemas';
import { UsersService } from '../service/users-service';

/** Persistence row to transport contract. The only place the two shapes meet. */
const toResponse = (user: UserSelect): UserResponse => ({
  id: user.id,
  email: user.email,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @HttpCode(201)
  @SerializeOptions({ schema: UserResponseSchema })
  @ApiOperation({
    summary: 'Register a user',
    description:
      'Validates the body against CreateUserRequest, then applies registration rules. ' +
      'A 409 carries a stable errorCode with a narrowing reason.',
  })
  @ApiBody({
    schema: openApiSchema(CreateUserRequestSchema, 'input'),
    examples: createUserExamples,
  })
  @ApiResponse({
    status: 201,
    description: 'User registered',
    standardSchema: UserResponseSchema,
    examples: userResponseExamples,
  })
  @ApiResponse({
    status: 400,
    description: 'Body failed contract validation',
    standardSchema: ApiErrorSchema,
  })
  @ApiResponse({
    status: 409,
    description: 'Registration refused — branch on errorCode, then reason',
    standardSchema: UserRegistrationFailedSchema,
    examples: userErrorExamples,
  })
  async create(
    @Body({ schema: CreateUserRequestSchema }) body: CreateUserRequest,
  ): Promise<UserResponse> {
    // Hashing is a placeholder — see the open questions in the README.
    const user = await this.users.create({ email: body.email, passwordHash: body.password });

    return toResponse(user);
  }

  @Get()
  @SerializeOptions({ schema: UserListResponseSchema })
  @ApiOperation({ summary: 'List users' })
  @ApiResponse({
    status: 200,
    description: 'A page of users',
    standardSchema: UserListResponseSchema,
  })
  async list(@Query({ schema: ListUsersQuerySchema }) query: ListUsersQuery) {
    const { rows, total } = await this.users.list(query);

    return {
      items: rows.map(toResponse),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  @Get(':id')
  @SerializeOptions({ schema: UserResponseSchema })
  @ApiOperation({ summary: 'Fetch a user by id' })
  @ApiResponse({ status: 200, description: 'The user', standardSchema: UserResponseSchema })
  @ApiResponse({ status: 404, description: 'No such user', standardSchema: ApiErrorSchema })
  async getById(@Param('id', { schema: UserIdSchema }) id: UserId): Promise<UserResponse> {
    return toResponse(await this.users.getById(id));
  }
}
