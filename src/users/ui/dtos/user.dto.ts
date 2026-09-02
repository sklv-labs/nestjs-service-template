import { ApiProperty } from '@nestjs/swagger';

import type { UserId, UserSelect } from '../../domain/schemas';

export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id!: UserId;

  @ApiProperty({ example: 'user@example.com', format: 'email' })
  email!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  /** Never returns `passwordHash` — the DTO is the boundary that keeps it out of responses. */
  static from(user: UserSelect): UserDto {
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
