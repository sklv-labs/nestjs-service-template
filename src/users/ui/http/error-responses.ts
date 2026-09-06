import { httpError } from '../../../shared/http';
import { UserNotFound, UserRegistrationFailed } from '../../domain';

/**
 * The HTTP shape of each business error this feature can raise, declared once.
 *
 * `httpError()` returns a plain value, so an endpoint referencing one of these restates neither the
 * status, the details example nor the description — which is what used to drift between endpoints
 * that could raise the same error.
 */

export const userRegistrationFailed = httpError(
  409,
  UserRegistrationFailed,
  { email: 'alex@example.com' },
  'Registration refused',
);

export const userNotFound = httpError(
  404,
  UserNotFound,
  { id: '01930000-0000-7000-8000-000000000000' },
  'No user with that id',
);
