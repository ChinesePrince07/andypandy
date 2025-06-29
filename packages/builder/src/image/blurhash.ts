import { encode, isBlurhashValid } from 'blurhash'
import sharp from 'sharp'

import { logger } from '../logger/index.js'

// 生成 blurhash（基于缩略图数据，保持长宽比）
export async function generateBlurhash(
  thumbnailBuffer: Buffer,
  originalWidth: number,
  originalHeight: number,
): Promise<string | null> {
  try {
    // 复用缩略图的 Sharp 实例来生成 blurhash
    // 确保转换为 raw RGBA 格式
    const { data, info } = await sharp(thumbnailBuffer)
      .raw()
      .ensureAlpha()
      .toBuffer({
        resolveWithObject: true,
      })

    const xComponents = 4
    const yComponents = 4

    logger.blurhash.info(
      `生成参数：原始 ${originalWidth}x${originalHeight}, 实际 ${info.width}x${info.height}, 组件 ${xComponents}x${yComponents}`,
    )

    // 生成 blurhash
    const blurhash = encode(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      xComponents,
      yComponents,
    )

    if (!isBlurhashValid(blurhash)) {
      logger.blurhash.error('生成失败：blurhash 无效', blurhash)
      return null
    }

    logger.blurhash.success(`生成成功：${blurhash}`)
    return blurhash
  } catch (error) {
    logger.blurhash.error('生成失败：', error)
    return null
  }
}
