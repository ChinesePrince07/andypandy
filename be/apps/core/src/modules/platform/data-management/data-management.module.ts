import { Module } from '@afilmory/framework'

import { BillingModule } from '../billing/billing.module'
import { DataManagementController } from './data-management.controller'
import { DataManagementService } from './data-management.service'

@Module({
  imports: [BillingModule],
  controllers: [DataManagementController],
  providers: [DataManagementService],
})
export class DataManagementModule {}
