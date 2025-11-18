import { Body, Controller, Get, Headers, Patch } from '@afilmory/framework'
import { Roles } from 'core/guards/roles.decorator'
import { BypassResponseTransform } from 'core/interceptors/response-transform.decorator'
import { SystemSettingService } from 'core/modules/configuration/system-setting/system-setting.service'

import { UpdateSuperAdminSettingsDto } from './super-admin.dto'

@Controller('super-admin/settings')
@Roles('superadmin')
export class SuperAdminSettingController {
  constructor(private readonly systemSettings: SystemSettingService) {}

  @Get('/')
  @BypassResponseTransform()
  async getOverview(@Headers('accept-language') acceptLanguage?: string) {
    return await this.systemSettings.getOverview(acceptLanguage)
  }

  @Patch('/')
  @BypassResponseTransform()
  async update(@Body() dto: UpdateSuperAdminSettingsDto, @Headers('accept-language') acceptLanguage?: string) {
    await this.systemSettings.updateSettings(dto)
    return await this.systemSettings.getOverview(acceptLanguage)
  }
}
