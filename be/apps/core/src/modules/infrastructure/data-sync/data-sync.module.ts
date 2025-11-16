import { Module } from '@afilmory/framework'
import { BuilderConfigService } from 'core/modules/configuration/builder-config/builder-config.service'
import { SystemSettingModule } from 'core/modules/configuration/system-setting/system-setting.module'

import { DataSyncController } from './data-sync.controller'
import { DataSyncService } from './data-sync.service'

@Module({
  imports: [SystemSettingModule],
  controllers: [DataSyncController],
  providers: [DataSyncService, BuilderConfigService],
})
export class DataSyncModule {}
