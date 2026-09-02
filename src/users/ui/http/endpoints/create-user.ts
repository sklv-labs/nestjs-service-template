import { email, str } from '../../../../shared/contracts';
import { endpoint } from '../../../../shared/http';
import { UserRegistrationFailed } from '../../../domain';
import type { CreateUserInput, CreateUserOutput } from '../../../operation';
import { toUserResponse, userResponse } from '../responses';

export const createUser = endpoint('Register a user')
  .about('Validates the body, then applies registration rules.')
  .headers({
    'x-request-id': str('Correlation id, echoed in logs').optional(),
  })
  .body({
    email: email("The user's primary email address"),
    password: str('Plaintext password, at least 12 characters', { min: 12, max: 256 }),
  })
  .example({ email: 'alex@example.com', password: 'correct-horse-battery-staple' })
  .input(({ body, headers }): CreateUserInput => ({
    email: body.email,
    password: body.password,
    correlationId: headers['x-request-id'],
  }))
  .output((out: CreateUserOutput) => toUserResponse(out.user))
  .ok(201, userResponse, 'User registered', {
    id: '01930000-0000-7000-8000-000000000000',
    email: 'alex@example.com',
    createdAt: '2026-09-03T10:00:00.000Z',
    updatedAt: '2026-09-03T10:00:00.000Z',
  })
  .fails(400, 'Body failed contract validation')
  .error(409, UserRegistrationFailed, { email: 'alex@example.com' }, 'Registration refused');
