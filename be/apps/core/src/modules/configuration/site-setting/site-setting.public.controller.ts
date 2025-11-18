import { Controller, Get, Headers } from '@afilmory/framework'
import { AllowPlaceholderTenant } from 'core/decorators/allow-placeholder.decorator'
import { SkipTenantGuard } from 'core/decorators/skip-tenant.decorator'
import { BypassResponseTransform } from 'core/interceptors/response-transform.decorator'

import { SiteSettingService } from './site-setting.service'

@Controller('public/site-settings')
@SkipTenantGuard()
export class SiteSettingPublicController {
  constructor(private readonly siteSettingService: SiteSettingService) {}

  @AllowPlaceholderTenant()
  @Get('/welcome-schema')
  @BypassResponseTransform()
  async getWelcomeSchema(@Headers('accept-language') acceptLanguage?: string) {
    return await this.siteSettingService.getOnboardingUiSchema(acceptLanguage)
  }
}
