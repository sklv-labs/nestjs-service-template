import { id } from '../../../../shared/contracts';
import { endpoint } from '../../../../shared/http';
import type { UserId } from '../../../domain';
import { UserNotFound } from '../../../domain';
import type { GetUserInput, GetUserOutput } from '../../../operation';
import { toUserResponse, userResponse } from '../responses';

export const getUser = endpoint('Fetch a user by id')
  .params({ id: id<UserId>('Identifier of the user') })
  .input(({ params }): GetUserInput => ({ id: params.id }))
  .output((out: GetUserOutput) => toUserResponse(out.user))
  .ok(200, userResponse, 'The user')
  .fails(400, 'The id is not a UUID v7')
  .error(404, UserNotFound, { id: '01930000-0000-7000-8000-000000000000' }, 'No user with that id');
