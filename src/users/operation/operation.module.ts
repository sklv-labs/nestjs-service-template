import { Module } from '@nestjs/common';

import { ServiceModule } from '../service/service.module';

/**
 * The operation layer composes services into use cases that span more than one service. It is
 * empty here on purpose — add orchestrators as they appear, and keep controllers depending on
 * this module rather than reaching into the service layer.
 */
@Module({
  imports: [ServiceModule],
  exports: [ServiceModule],
})
export class OperationModule {}
