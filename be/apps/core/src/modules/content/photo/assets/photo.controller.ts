import { Body, ContextParam, Controller, Delete, Get, Param, Patch, Post, Query } from '@afilmory/framework'
import { BizException, ErrorCode } from 'core/errors'
import { Roles } from 'core/guards/roles.decorator'
import { BypassResponseTransform } from 'core/interceptors/response-transform.decorator'
import type { DataSyncProgressEvent } from 'core/modules/infrastructure/data-sync/data-sync.types'
import { createProgressSseResponse } from 'core/modules/shared/http/sse'
import type { Context } from 'hono'
import { inject } from 'tsyringe'

import { UpdatePhotoTagsDto } from './photo-asset.dto'
import type { PhotoAssetListItem, PhotoAssetSummary } from './photo-asset.service'
import { PhotoAssetService } from './photo-asset.service'

type DeleteAssetsDto = {
  ids?: string[]
  deleteFromStorage?: boolean
}

@Controller('photos')
@Roles('admin')
export class PhotoController {
  constructor(@inject(PhotoAssetService) private readonly photoAssetService: PhotoAssetService) {}

  @Get('assets')
  @BypassResponseTransform()
  async listAssets(): Promise<PhotoAssetListItem[]> {
    return await this.photoAssetService.listAssets()
  }

  @Get('assets/summary')
  async getSummary(): Promise<PhotoAssetSummary> {
    return await this.photoAssetService.getSummary()
  }

  @Delete('assets')
  async deleteAssets(@Body() body: DeleteAssetsDto) {
    const ids = Array.isArray(body?.ids) ? body.ids : []
    const deleteFromStorage = body?.deleteFromStorage === true
    await this.photoAssetService.deleteAssets(ids, { deleteFromStorage })
    return { ids, deleted: true, deleteFromStorage }
  }

  @Post('assets/upload')
  async uploadAssets(@ContextParam() context: Context): Promise<Response> {
    return createProgressSseResponse<DataSyncProgressEvent>({
      context,
      handler: async ({ sendEvent, abortSignal }) => {
        try {
          const formData = await context.req.formData()
          let directory: string | null = null

          const directoryEntries = formData.getAll('directory')
          if (directoryEntries.length > 0) {
            const candidate = directoryEntries.find((entry): entry is string => typeof entry === 'string')
            directory = candidate ?? null
          }

          const files: File[] = []
          for (const entry of formData.getAll('files')) {
            if (entry instanceof File) {
              files.push(entry)
            }
          }

          if (files.length === 0) {
            throw new BizException(ErrorCode.COMMON_BAD_REQUEST, {
              message: '未找到可上传的文件',
            })
          }

          const inputs = await Promise.all(
            files.map(async (file) => ({
              filename: file.name,
              buffer: Buffer.from(await file.arrayBuffer()),
              contentType: file.type || undefined,
              directory,
            })),
          )

          await this.photoAssetService.uploadAssets(inputs, {
            progress: async (event) => {
              sendEvent(event)
            },
            abortSignal,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : '上传失败'
          sendEvent({ type: 'error', payload: { message } })
        }
      },
    })
  }

  @Get('storage-url')
  async getStorageUrl(@Query() query: { key?: string }) {
    const key = query?.key?.trim()
    if (!key) {
      throw new BizException(ErrorCode.COMMON_BAD_REQUEST, { message: '缺少 storage key 参数' })
    }

    const url = await this.photoAssetService.generatePublicUrl(key)
    return { url }
  }

  @Patch('assets/:id/tags')
  async updateAssetTags(@Param('id') id: string, @Body() body: UpdatePhotoTagsDto): Promise<PhotoAssetListItem> {
    return await this.photoAssetService.updateAssetTags(id, body.tags ?? [])
  }
}
