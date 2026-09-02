import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { asUuid } from '@sklv-labs/core/utils';

import type { UserId } from '../domain/schemas';
import { UsersService } from '../service/users-service';

import { CreateUserDto, UserDto } from './dtos';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @ApiCreatedResponse({ type: UserDto })
  async create(@Body() body: CreateUserDto): Promise<UserDto> {
    // Hashing belongs in the service layer once you add a hasher; the DTO carries the raw value
    // no further than this call.
    const user = await this.users.create({ email: body.email, passwordHash: body.password });

    return UserDto.from(user);
  }

  @Get(':id')
  @ApiOkResponse({ type: UserDto })
  async getById(@Param('id', ParseUUIDPipe) id: string): Promise<UserDto> {
    return UserDto.from(await this.users.getById(asUuid<UserId>(id)));
  }
}
