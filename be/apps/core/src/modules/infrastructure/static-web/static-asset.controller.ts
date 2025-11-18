import { ContextParam, Controller, Get } from '@afilmory/framework'
import { AllowPlaceholderTenant } from 'core/decorators/allow-placeholder.decorator'
import { SkipTenantGuard } from 'core/decorators/skip-tenant.decorator'
import type { Context } from 'hono'

import { StaticBaseController } from './static-base.controller'
import { StaticControllerUtils } from './static-controller.utils'
import { StaticDashboardService } from './static-dashboard.service'
import { StaticWebService } from './static-web.service'

@Controller({ bypassGlobalPrefix: true })
export class StaticAssetController extends StaticBaseController {
  constructor(staticWebService: StaticWebService, staticDashboardService: StaticDashboardService) {
    super(staticWebService, staticDashboardService)
  }

  @SkipTenantGuard()
  @AllowPlaceholderTenant()
  @Get('/*')
  async getAsset(@ContextParam() context: Context) {
    const response = await this.handleAssetRequest(context, false)
    return StaticControllerUtils.applyStaticAssetCors(response)
  }
}
