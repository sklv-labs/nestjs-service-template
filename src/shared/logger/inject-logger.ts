import { Inject, Scope } from '@nestjs/common';
import type { Provider } from '@nestjs/common';
import { INQUIRER } from '@nestjs/core';

import type { Logger } from './logger.service';
import { LoggerService } from './logger.service';

export const LOGGER = Symbol('LOGGER');

/**
 * A logger already bound to the class it is injected into, as a property.
 *
 * ```ts
 * @Injectable()
 * export class UsersService {
 *   @InjectLogger() private readonly logger: Logger;
 * }
 * ```
 *
 * No constructor, and no repeating the class name — `INQUIRER` supplies it. The provider is
 * transient, so each consumer gets its own instance; that is one child logger per class created at
 * bootstrap, not per request, so it costs nothing on the hot path.
 */
export const InjectLogger = (): PropertyDecorator & ParameterDecorator => Inject(LOGGER);

export const loggerProvider: Provider = {
  provide: LOGGER,
  scope: Scope.TRANSIENT,
  inject: [LoggerService, INQUIRER],
  useFactory: (root: LoggerService, inquirer: object | undefined): Logger =>
    root.forContext(inquirer?.constructor?.name ?? 'App'),
};
