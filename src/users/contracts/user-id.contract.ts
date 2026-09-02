import type { Uuid } from '@sklv-labs/core';

import { brandedUuid } from '../../contracts';

export type UserId = Uuid<'users'>;

export const UserIdSchema = brandedUuid<UserId>().describe('Identifier of a user (UUID v7)');
