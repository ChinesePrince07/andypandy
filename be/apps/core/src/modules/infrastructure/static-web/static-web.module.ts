import { Module } from '@afilmory/framework'
import { SiteSettingModule } from 'core/modules/configuration/site-setting/site-setting.module'
import { SystemSettingModule } from 'core/modules/configuration/system-setting/system-setting.module'
import { ManifestModule } from 'core/modules/content/manifest/manifest.module'

import { StaticAssetHostService } from './static-asset-host.service'
import { StaticDashboardService } from './static-dashboard.service'
import { StaticWebController } from './static-web.controller'
import { StaticWebService } from './static-web.service'

@Module({
  imports: [SiteSettingModule, SystemSettingModule, ManifestModule],
  controllers: [StaticWebController],
  providers: [StaticAssetHostService, StaticWebService, StaticDashboardService],
})
export class StaticWebModule {}
