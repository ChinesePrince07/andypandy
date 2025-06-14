import type { FujiRecipe, PickedExif } from '@afilmory/builder'
import type { FC } from 'react'

import { i18nAtom } from '~/i18n'
import { jotaiStore } from '~/lib/jotai'

import { EllipsisHorizontalTextWithTooltip } from '../typography'

// Helper function to clean up EXIF values by removing unnecessary characters
const cleanExifValue = (value: string | null | undefined): string | null => {
  if (!value) return null

  // Remove parenthetical descriptions like "(medium soft)" from "-1 (medium soft)"
  const cleaned = value.replace(/\s*\([^)]*\)$/, '')

  return cleaned.trim() || null
}

// Helper function to get translation key for EXIF values
const getTranslationKey = (
  category: string,
  value: string | number | null,
): string | null => {
  if (value === null || value === undefined) return null

  const normalizedValue = String(value)
    .toLowerCase()
    .replaceAll(/\s+/g, '-')
    .replaceAll(/[^\w.-]/g, '')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-+|-+$/g, '')

  return `exif.${category}.${normalizedValue}`
}

// Translation functions for different EXIF categories
const translateExifValue = (
  category: string,
  value: string | number | null,
): string | null => {
  if (!value) return null

  const i18n = jotaiStore.get(i18nAtom)
  const translationKey = getTranslationKey(category, value)

  if (!translationKey) return cleanExifValue(String(value))

  // Try to get translation, fallback to cleaned original value
  const cleanedValue = cleanExifValue(String(value))
  if (!i18n.exists(translationKey)) {
    return cleanedValue
  }

  const translated = i18n.t(translationKey as any)
  return translated || cleanedValue
}

const createTranslator =
  (category: string) =>
  (value: string | number | null): string | null => {
    if (value === null || value === undefined) return null
    return translateExifValue(category, value)
  }

// Specific translation functions for different EXIF fields
const translateExposureMode = createTranslator('exposure.mode')
const translateMeteringMode = createTranslator('metering.mode')
const translateWhiteBalance = createTranslator('white.balance')
const translateFlash = createTranslator('flash')
const translateLightSource = createTranslator('light.source')
const translateSensingMethod = createTranslator('sensing.method')
const translateColorSpace = createTranslator('colorspace')
const translateExposureProgram = createTranslator('exposureprogram')

const translateFujiGrainEffectRoughness = createTranslator(
  'fujirecipe-graineffectroughness',
)
const translateFujiGrainEffectSize = createTranslator(
  'fujirecipe-graineffectsize',
)
const translateFujiColorChromeEffect = createTranslator(
  'fujirecipe-colorchromeeffect',
)
const translateFujiColorChromeFxBlue = createTranslator(
  'fujirecipe-colorchromefxblue',
)
const translateFujiDynamicRange = createTranslator('fujirecipe-dynamicrange')
const translateFujiSharpness = createTranslator('fujirecipe-sharpness')
const translateFujiWhiteBalance = createTranslator('fujirecipe-whitebalance')

// 翻译白平衡偏移字段中的 Red 和 Blue
const translateWhiteBalanceFineTune = (value: string | null): string | null => {
  if (!value) return null

  const i18n = jotaiStore.get(i18nAtom)
  const redTranslation = i18n.t('exif.white.balance.red')
  const blueTranslation = i18n.t('exif.white.balance.blue')

  // 替换 Red 和 Blue 文本，保持数值和符号不变
  return value
    .replaceAll(/\bRed\b/g, redTranslation)
    .replaceAll(/\bBlue\b/g, blueTranslation)
}

// Helper function to process Fuji Recipe values and clean them
const processFujiRecipeValue = (
  value: string | null | undefined,
): string | null => {
  return cleanExifValue(value)
}

// Process entire Fuji Recipe object
const processFujiRecipe = (recipe: FujiRecipe): any => {
  if (!recipe) return null

  const processed = { ...recipe } as any

  // Clean specific fields that commonly have unnecessary characters
  if (processed.HighlightTone) {
    processed.HighlightTone = processFujiRecipeValue(recipe.HighlightTone)
  }
  if (processed.ShadowTone) {
    processed.ShadowTone = processFujiRecipeValue(recipe.ShadowTone)
  }
  if (processed.Saturation) {
    processed.Saturation = processFujiRecipeValue(recipe.Saturation)
  }
  if (processed.NoiseReduction) {
    processed.NoiseReduction = processFujiRecipeValue(recipe.NoiseReduction)
  }
  if (processed.FilmMode) {
    processed.FilmMode = processFujiRecipeValue(recipe.FilmMode)
  }

  if (processed.GrainEffectRoughness) {
    processed.GrainEffectRoughness = translateFujiGrainEffectRoughness(
      recipe.GrainEffectRoughness,
    )
  }
  if (processed.GrainEffectSize) {
    processed.GrainEffectSize = translateFujiGrainEffectSize(
      recipe.GrainEffectSize,
    )
  }
  if (processed.ColorChromeEffect) {
    processed.ColorChromeEffect = translateFujiColorChromeEffect(
      recipe.ColorChromeEffect,
    )
  }
  if (processed.ColorChromeFxBlue) {
    processed.ColorChromeFxBlue = translateFujiColorChromeFxBlue(
      recipe.ColorChromeFxBlue,
    )
  }
  if (processed.DynamicRange) {
    processed.DynamicRange = translateFujiDynamicRange(recipe.DynamicRange)
  }
  if (processed.Sharpness) {
    processed.Sharpness = translateFujiSharpness(recipe.Sharpness)
  }
  if (processed.WhiteBalance) {
    processed.WhiteBalance = translateFujiWhiteBalance(recipe.WhiteBalance)
  }
  if (processed.WhiteBalanceFineTune) {
    processed.WhiteBalanceFineTune = translateWhiteBalanceFineTune(
      recipe.WhiteBalanceFineTune,
    )
  }

  return processed
}

export const formatExifData = (exif: PickedExif | null) => {
  if (!exif) return null

  // 等效焦距 (35mm)
  const focalLength35mm = exif.FocalLengthIn35mmFormat
    ? Number.parseInt(exif.FocalLengthIn35mmFormat)
    : null

  // 实际焦距
  const focalLength = exif.FocalLength
    ? Number.parseInt(exif.FocalLength)
    : null

  // ISO
  const iso = exif.ISO

  // 快门速度
  const exposureTime = exif.ExposureTime
  const shutterSpeed = `${exposureTime}s`

  // 光圈
  const aperture = exif.FNumber ? `f/${exif.FNumber}` : null

  // 最大光圈
  const maxAperture = exif.MaxApertureValue

  // 相机信息
  const camera = exif.Make && exif.Model ? `${exif.Make} ${exif.Model}` : null

  // 镜头信息
  const lens = exif.LensModel || null

  // 软件信息
  const software = exif.Software || null

  const offsetTimeOriginal = exif.OffsetTimeOriginal || exif.OffsetTime
  // 拍摄时间
  const dateTime: string | null = (() => {
    const originalDateTimeStr = exif.DateTimeOriginal || (exif as any).DateTime

    if (!originalDateTimeStr) return null

    const date = new Date(originalDateTimeStr)

    if (offsetTimeOriginal) {
      // 解析时区偏移，例如 "+08:00" 或 "-05:00"
      const offsetMatch = offsetTimeOriginal.match(/([+-])(\d{2}):(\d{2})/)
      if (offsetMatch) {
        const [, sign, hours, minutes] = offsetMatch
        const offsetMinutes =
          (Number.parseInt(hours) * 60 + Number.parseInt(minutes)) *
          (sign === '+' ? 1 : -1)

        // 减去偏移量，将本地时间转换为 UTC 时间
        const utcTime = new Date(date.getTime() - offsetMinutes * 60 * 1000)
        return formatDateTime(utcTime)
      }

      return formatDateTime(date)
    }

    return formatDateTime(date)
  })()

  // 曝光模式 - with translation
  const exposureMode = translateExposureMode(exif.ExposureMode || null)

  // 测光模式 - with translation
  const meteringMode = translateMeteringMode(exif.MeteringMode || null)

  // 白平衡 - with translation
  const whiteBalance = translateWhiteBalance(exif.WhiteBalance || null)

  // 闪光灯 - with translation
  const flash = translateFlash(exif.Flash || null)

  // 曝光补偿
  const exposureBias = exif.ExposureCompensation
    ? `${exif.ExposureCompensation} EV`
    : null

  // 亮度值
  const brightnessValue = exif.BrightnessValue
    ? `${exif.BrightnessValue.toFixed(1)} EV`
    : null

  // 快门速度值
  const shutterSpeedValue = exif.ShutterSpeedValue

  // 光圈值
  const apertureValue = exif.ApertureValue
    ? `${exif.ApertureValue.toFixed(1)} EV`
    : null

  // 光源类型 - with translation
  const lightSource = translateLightSource(exif.LightSource || null)

  // 白平衡偏移/微调相关字段
  const whiteBalanceBias = exif.WhiteBalanceBias || null
  const wbShiftAB = exif.WBShiftAB || null
  const wbShiftGM = exif.WBShiftGM || null
  const whiteBalanceFineTune = translateWhiteBalanceFineTune(
    exif.WhiteBalanceFineTune ? String(exif.WhiteBalanceFineTune) : null,
  )

  // 感光方法 - with translation
  const sensingMethod = translateSensingMethod(exif.SensingMethod || null)

  // 焦平面分辨率
  const focalPlaneXResolution = exif.FocalPlaneXResolution
    ? Math.round(exif.FocalPlaneXResolution)
    : null
  const focalPlaneYResolution = exif.FocalPlaneYResolution
    ? Math.round(exif.FocalPlaneYResolution)
    : null

  // 像素信息
  const pixelXDimension = exif.ImageWidth || null
  const pixelYDimension = exif.ImageHeight || null
  const totalPixels =
    pixelXDimension && pixelYDimension
      ? pixelXDimension * pixelYDimension
      : null
  const megaPixels = totalPixels
    ? `${(totalPixels / 1000000).toFixed(1)}MP`
    : null

  // 色彩空间 - with translation
  const colorSpace = translateColorSpace(exif.ColorSpace || null)

  // GPS 信息
  const gpsInfo = null

  // 富士相机 Recipe 信息 - with cleaning

  const exposureProgram = translateExposureProgram(exif.ExposureProgram || null)

  return {
    focalLength35mm,
    focalLength,
    iso,
    shutterSpeed,
    aperture,
    maxAperture,
    camera,
    lens,
    software,
    dateTime,
    exposureMode,
    meteringMode,
    whiteBalance,
    flash,
    colorSpace,
    gps: gpsInfo,
    exposureBias,
    brightnessValue,
    shutterSpeedValue,
    apertureValue,
    lightSource,
    sensingMethod,

    focalPlaneXResolution,
    focalPlaneYResolution,

    megaPixels,
    pixelXDimension,
    pixelYDimension,
    whiteBalanceBias,
    wbShiftAB,
    wbShiftGM,
    whiteBalanceFineTune,

    fujiRecipe: exif.FujiRecipe ? processFujiRecipe(exif.FujiRecipe) : null,
    exposureProgram,
  }
}
export const Row: FC<{
  label: string
  value: string | number | null | undefined | number[]
  ellipsis?: boolean
}> = ({ label, value, ellipsis }) => {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-text-secondary shrink-0">{label}</span>

      {ellipsis ? (
        <span className="relative min-w-0 flex-1 shrink">
          <span className="absolute inset-0">
            <EllipsisHorizontalTextWithTooltip className="text-text min-w-0 text-right">
              {Array.isArray(value) ? value.join(' ') : value}
            </EllipsisHorizontalTextWithTooltip>
          </span>
        </span>
      ) : (
        <span className="text-text min-w-0 text-right">
          {Array.isArray(value) ? value.join(' ') : value}
        </span>
      )}
    </div>
  )
}
const formatDateTime = (date: Date | null | undefined) => {
  const i18n = jotaiStore.get(i18nAtom)
  const datetimeFormatter = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'short',
    timeStyle: 'medium',
  })
  if (!date) return ''

  return datetimeFormatter.format(date)
}
