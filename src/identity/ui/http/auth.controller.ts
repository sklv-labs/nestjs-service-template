import { Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { BodyOf } from '@sklv-labs/nestjs-core/http';
import { ReqBody, UseEndpoint } from '@sklv-labs/nestjs-core/http';

import { RegisterUserHandler } from '../../operation';

import { registerUser } from './endpoints';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly registerHandler: RegisterUserHandler) {}

  @Post('register')
  @UseEndpoint(registerUser)
  async register(@ReqBody(registerUser) body: BodyOf<typeof registerUser>) {
    const output = await this.registerHandler.execute(registerUser.toInput({ body }));

    return registerUser.toResponse(output);
  }
}
