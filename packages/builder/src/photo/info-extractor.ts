import path from 'node:path'

import { env } from '@env'

import type { PhotoInfo, PickedExif } from '../types/photo.js'
import { getGlobalLoggers } from './logger-adapter.js'

// 从文件名提取照片信息
export function extractPhotoInfo(
  key: string,
  exifData?: PickedExif | null,
): PhotoInfo {
  const log = getGlobalLoggers().image

  log.info(`提取照片信息：${key}`)

  const fileName = path.basename(key, path.extname(key))

  // 尝试从文件名解析信息，格式示例："2024-01-15_城市夜景_1250views"
  let title = fileName
  let dateTaken = new Date().toISOString()
  let views = 0
  let tags: string[] = []

  // 从目录路径中提取 tags
  const dirPath = path.dirname(key)
  if (dirPath && dirPath !== '.' && dirPath !== '/') {
    // 移除前缀（如果有的话）
    let relativePath = dirPath
    if (env.S3_PREFIX && dirPath.startsWith(env.S3_PREFIX)) {
      relativePath = dirPath.slice(env.S3_PREFIX.length)
    }

    // 清理路径分隔符
    relativePath = relativePath.replaceAll(/^\/+|\/+$/g, '')

    if (relativePath) {
      // 分割路径并过滤空字符串
      const pathParts = relativePath
        .split('/')
        .filter((part) => part.trim() !== '')
      tags = pathParts.map((part) => part.trim())

      log.info(`从路径提取标签：[${tags.join(', ')}]`)
    }
  }

  // 优先使用 EXIF 中的 DateTimeOriginal
  if (exifData?.DateTimeOriginal) {
    try {
      const dateTimeOriginal = new Date(exifData.DateTimeOriginal)

      // 如果是 Date 对象，直接使用
      if (dateTimeOriginal instanceof Date) {
        dateTaken = dateTimeOriginal.toISOString()
        log.info('使用 EXIF Date 对象作为拍摄时间')
      } else {
        log?.warn(
          `未知的 DateTimeOriginal 类型：${typeof dateTimeOriginal}`,
          dateTimeOriginal,
        )
      }
    } catch (error) {
      log?.warn(
        `解析 EXIF DateTimeOriginal 失败：${exifData.DateTimeOriginal}`,
        error,
      )
    }
  } else {
    // 如果 EXIF 中没有日期，尝试从文件名解析
    const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/)
    if (dateMatch) {
      dateTaken = new Date(dateMatch[1]).toISOString()
      log.info(`从文件名提取拍摄时间：${dateMatch[1]}`)
    }
  }

  // 如果文件名包含浏览次数
  const viewsMatch = fileName.match(/(\d+)views?/i)
  if (viewsMatch) {
    views = Number.parseInt(viewsMatch[1])
    log.info(`从文件名提取浏览次数：${views}`)
  }

  // 从 EXIF 数据中提取设备标签（相机和镜头）
  const equipmentTags: string[] = []
  if (exifData) {
    // 相机信息标签
    if (exifData.Make && exifData.Model) {
      const cameraTag = `${exifData.Make} ${exifData.Model}`.trim()
      equipmentTags.push(cameraTag)
      log.info(`从 EXIF 提取相机标签：${cameraTag}`)
    } else if (exifData.Make) {
      equipmentTags.push(exifData.Make)
      log.info(`从 EXIF 提取相机品牌标签：${exifData.Make}`)
    } else if (exifData.Model) {
      equipmentTags.push(exifData.Model)
      log.info(`从 EXIF 提取相机型号标签：${exifData.Model}`)
    }

    // 镜头信息标签
    if (exifData.LensModel) {
      let lensTag = exifData.LensModel
      // 如果镜头有制造商信息且与相机制造商不同，也添加制造商
      if (exifData.LensMake && exifData.LensMake !== exifData.Make) {
        lensTag = `${exifData.LensMake} ${exifData.LensModel}`
      }
      equipmentTags.push(lensTag.trim())
      log.info(`从 EXIF 提取镜头标签：${lensTag}`)
    } else if (exifData.LensMake) {
      equipmentTags.push(exifData.LensMake)
      log.info(`从 EXIF 提取镜头品牌标签：${exifData.LensMake}`)
    }
  }

  // 从文件名中提取标题（移除日期和浏览次数）
  title = fileName
    .replaceAll(/\d{4}-\d{2}-\d{2}[_-]?/g, '')
    .replaceAll(/[_-]?\d+views?/gi, '')
    .replaceAll(/[_-]+/g, ' ')
    .trim()

  // 如果标题为空，使用文件名
  if (!title) {
    title = path.basename(key, path.extname(key))
  }

  log.info(
    `照片信息提取完成："${title}"，路径标签：[${tags.join(', ')}]，设备标签：[${equipmentTags.join(', ')}]`,
  )

  return {
    title,
    dateTaken,
    tags, // 只包含路径等显示标签
    equipmentTags, // 设备标签，仅用于筛选
    description: '', // 可以从 EXIF 或其他元数据中获取
  }
}
