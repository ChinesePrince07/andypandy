import { Body, Controller, Get, Headers, Post } from '@afilmory/framework'
import { Roles } from 'core/guards/roles.decorator'
import { BypassResponseTransform } from 'core/interceptors/response-transform.decorator'

import { UpdateBuilderSettingsDto } from './builder-setting.dto'
import { BuilderSettingService } from './builder-setting.service'

@Controller('builder/settings')
@Roles('superadmin')
export class BuilderSettingController {
  constructor(private readonly builderSettingService: BuilderSettingService) {}

  @Get('/ui-schema')
  @BypassResponseTransform()
  async getUiSchema(@Headers('accept-language') acceptLanguage?: string) {
    return await this.builderSettingService.getUiSchema(acceptLanguage)
  }

  @Get('/')
  @BypassResponseTransform()
  async getSettings() {
    return await this.builderSettingService.getSettings()
  }

  @Post('/')
  async update(@Body() payload: UpdateBuilderSettingsDto) {
    await this.builderSettingService.update(payload)
    return { updated: true }
  }
}
