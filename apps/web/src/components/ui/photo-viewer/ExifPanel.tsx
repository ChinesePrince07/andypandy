import './PhotoViewer.css'

import type { Exif } from 'exif-reader'
import { m } from 'motion/react'
import type { FC } from 'react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'
import { useMobile } from '~/hooks/useMobile'
import { i18nAtom } from '~/i18n'
import {
  CarbonIsoOutline,
  MaterialSymbolsExposure,
  MaterialSymbolsShutterSpeed,
  StreamlineImageAccessoriesLensesPhotosCameraShutterPicturePhotographyPicturesPhotoLens,
  TablerAperture,
} from '~/icons'
import { getImageFormat } from '~/lib/image-utils'
import { jotaiStore } from '~/lib/jotai'
import { Spring } from '~/lib/spring'
import type { PhotoManifest } from '~/types/photo'

import { MotionButtonBase } from '../button'
import { EllipsisHorizontalTextWithTooltip } from '../typography'

export const ExifPanel: FC<{
  currentPhoto: PhotoManifest
  exifData: Exif | null

  onClose?: () => void
}> = ({ currentPhoto, exifData, onClose }) => {
  const { t } = useTranslation()
  const isMobile = useMobile()
  const formattedExifData = formatExifData(exifData, t)

  // 使用通用的图片格式提取函数
  const imageFormat = getImageFormat(
    currentPhoto.originalUrl || currentPhoto.s3Key || '',
  )

  return (
    <m.div
      className={`${
        isMobile
          ? 'exif-panel-mobile fixed right-0 bottom-0 left-0 max-h-[60vh] w-full rounded-t-2xl backdrop-blur-[70px]'
          : 'w-80 shrink-0'
      } bg-material-medium z-10 flex flex-col text-white`}
      initial={{
        opacity: 0,
        ...(isMobile ? { y: 100 } : { x: 100 }),
      }}
      animate={{
        opacity: 1,
        ...(isMobile ? { y: 0 } : { x: 0 }),
      }}
      exit={{
        opacity: 0,
        ...(isMobile ? { y: 100 } : { x: 100 }),
      }}
      transition={Spring.presets.smooth}
    >
      <div className="mb-4 flex shrink-0 items-center justify-between p-4 pb-0">
        <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold`}>
          {t('exif.header.title')}
        </h3>
        {isMobile && onClose && (
          <button
            type="button"
            className="flex size-6 items-center justify-center rounded-full text-white/70 duration-200 hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <i className="i-mingcute-close-line text-sm" />
          </button>
        )}
      </div>

      <ScrollArea
        rootClassName="flex-1 min-h-0 overflow-auto lg:overflow-hidden"
        viewportClassName="px-4 pb-4"
      >
        <div className={`space-y-${isMobile ? '3' : '4'}`}>
          {/* 基本信息和标签 - 合并到一个 section */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-white/80">
              {t('exif.basic.info')}
            </h4>
            <div className="space-y-1 text-sm">
              <Row
                label={t('exif.filename')}
                value={currentPhoto.title}
                ellipsis
              />
              <Row label={t('exif.format')} value={imageFormat} />
              <Row
                label={t('exif.dimensions')}
                value={`${currentPhoto.width} × ${currentPhoto.height}`}
              />
              <Row
                label={t('exif.file.size')}
                value={`${(currentPhoto.size / 1024 / 1024).toFixed(1)}MB`}
              />
              {formattedExifData?.megaPixels && (
                <Row
                  label={t('exif.pixels')}
                  value={`${Math.floor(
                    Number.parseFloat(formattedExifData.megaPixels),
                  )} MP`}
                />
              )}
              {formattedExifData?.colorSpace && (
                <Row
                  label={t('exif.color.space')}
                  value={formattedExifData.colorSpace}
                />
              )}

              {formattedExifData?.dateTime && (
                <Row
                  label={t('exif.capture.time')}
                  value={formattedExifData.dateTime}
                />
              )}
            </div>

            {/* 标签信息 - 移到基本信息 section 内 */}
            {currentPhoto.tags && currentPhoto.tags.length > 0 && (
              <div className="mt-3">
                <div className="mb-2 text-sm text-white/80">
                  {t('exif.tags')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {currentPhoto.tags.map((tag) => (
                    <MotionButtonBase
                      type="button"
                      onClick={() => {
                        window.open(
                          `/?tags=${tag}`,
                          '_blank',
                          'noopener,noreferrer',
                        )
                      }}
                      key={tag}
                      className="bg-material-medium hover:bg-material-thin inline-flex cursor-pointer items-center rounded-full px-2 py-1 text-xs text-white/90 backdrop-blur-sm"
                    >
                      {tag}
                    </MotionButtonBase>
                  ))}
                </div>
              </div>
            )}
          </div>

          {formattedExifData && (
            <Fragment>
              {(formattedExifData.camera || formattedExifData.lens) && (
                <div>
                  <h4 className="my-2 text-sm font-medium text-white/80">
                    {t('exif.device.info')}
                  </h4>
                  <div className="space-y-1 text-sm">
                    {formattedExifData.camera && (
                      <Row
                        label={t('exif.camera')}
                        value={formattedExifData.camera}
                      />
                    )}
                    {formattedExifData.lens && (
                      <Row
                        label={t('exif.lens')}
                        value={formattedExifData.lens}
                      />
                    )}

                    {formattedExifData.focalLength && (
                      <Row
                        label={t('exif.focal.length.actual')}
                        value={`${formattedExifData.focalLength}mm`}
                      />
                    )}
                    {formattedExifData.focalLength35mm && (
                      <Row
                        label={t('exif.focal.length.equivalent')}
                        value={`${formattedExifData.focalLength35mm}mm`}
                      />
                    )}
                    {formattedExifData.maxAperture && (
                      <Row
                        label={t('exif.max.aperture')}
                        value={`f/${formattedExifData.maxAperture}`}
                      />
                    )}
                    {formattedExifData.digitalZoom && (
                      <Row
                        label={t('exif.digital.zoom')}
                        value={`${formattedExifData.digitalZoom.toFixed(2)}x`}
                      />
                    )}
                  </div>
                </div>
              )}

              <div>
                <h4 className="my-2 text-sm font-medium text-white/80">
                  {t('exif.capture.parameters')}
                </h4>
                <div className={`grid grid-cols-2 gap-2`}>
                  {formattedExifData.focalLength35mm && (
                    <div className="flex h-6 items-center gap-2 rounded-md bg-white/10 px-2">
                      <StreamlineImageAccessoriesLensesPhotosCameraShutterPicturePhotographyPicturesPhotoLens className="text-sm text-white/70" />
                      <span className="text-xs">
                        {formattedExifData.focalLength35mm}mm
                      </span>
                    </div>
                  )}

                  {formattedExifData.aperture && (
                    <div className="flex h-6 items-center gap-2 rounded-md bg-white/10 px-2">
                      <TablerAperture className="text-sm text-white/70" />
                      <span className="text-xs">
                        {formattedExifData.aperture}
                      </span>
                    </div>
                  )}

                  {formattedExifData.shutterSpeed && (
                    <div className="flex h-6 items-center gap-2 rounded-md bg-white/10 px-2">
                      <MaterialSymbolsShutterSpeed className="text-sm text-white/70" />
                      <span className="text-xs">
                        {formattedExifData.shutterSpeed}
                      </span>
                    </div>
                  )}

                  {formattedExifData.iso && (
                    <div className="flex h-6 items-center gap-2 rounded-md bg-white/10 px-2">
                      <CarbonIsoOutline className="text-sm text-white/70" />
                      <span className="text-xs">
                        ISO {formattedExifData.iso}
                      </span>
                    </div>
                  )}

                  {formattedExifData.exposureBias && (
                    <div className="flex h-6 items-center gap-2 rounded-md bg-white/10 px-2">
                      <MaterialSymbolsExposure className="text-sm text-white/70" />
                      <span className="text-xs">
                        {formattedExifData.exposureBias}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 新增：拍摄模式信息 */}
              {(formattedExifData.exposureMode ||
                formattedExifData.meteringMode ||
                formattedExifData.whiteBalance ||
                formattedExifData.lightSource ||
                formattedExifData.flash) && (
                <div>
                  <h4 className="my-2 text-sm font-medium text-white/80">
                    {t('exif.capture.mode')}
                  </h4>
                  <div className="space-y-1 text-sm">
                    {formattedExifData.exposureMode && (
                      <Row
                        label={t('exif.exposure.mode.title')}
                        value={formattedExifData.exposureMode}
                      />
                    )}
                    {formattedExifData.meteringMode && (
                      <Row
                        label={t('exif.metering.mode.type')}
                        value={formattedExifData.meteringMode}
                      />
                    )}
                    {formattedExifData.whiteBalance && (
                      <Row
                        label={t('exif.white.balance.title')}
                        value={formattedExifData.whiteBalance}
                      />
                    )}
                    {formattedExifData.whiteBalanceBias && (
                      <Row
                        label={t('exif.white.balance.bias')}
                        value={`${formattedExifData.whiteBalanceBias} Mired`}
                      />
                    )}
                    {formattedExifData.wbShiftAB && (
                      <Row
                        label={t('exif.white.balance.shift.ab')}
                        value={formattedExifData.wbShiftAB}
                      />
                    )}
                    {formattedExifData.wbShiftGM && (
                      <Row
                        label={t('exif.white.balance.shift.gm')}
                        value={formattedExifData.wbShiftGM}
                      />
                    )}
                    {formattedExifData.whiteBalanceFineTune && (
                      <Row
                        label={t('exif.white.balance.fine.tune')}
                        value={formattedExifData.whiteBalanceFineTune}
                      />
                    )}
                    {formattedExifData.wbGRBLevels && (
                      <Row
                        label={t('exif.white.balance.grb')}
                        value={
                          Array.isArray(formattedExifData.wbGRBLevels)
                            ? formattedExifData.wbGRBLevels.join(' ')
                            : formattedExifData.wbGRBLevels
                        }
                      />
                    )}
                    {formattedExifData.wbGRBLevelsStandard && (
                      <Row
                        label={t('exif.standard.white.balance.grb')}
                        value={
                          Array.isArray(formattedExifData.wbGRBLevelsStandard)
                            ? formattedExifData.wbGRBLevelsStandard.join(' ')
                            : formattedExifData.wbGRBLevelsStandard
                        }
                      />
                    )}
                    {formattedExifData.wbGRBLevelsAuto && (
                      <Row
                        label={t('exif.auto.white.balance.grb')}
                        value={
                          Array.isArray(formattedExifData.wbGRBLevelsAuto)
                            ? formattedExifData.wbGRBLevelsAuto.join(' ')
                            : formattedExifData.wbGRBLevelsAuto
                        }
                      />
                    )}
                    {formattedExifData.flash && (
                      <Row
                        label={t('exif.flash.title')}
                        value={formattedExifData.flash}
                      />
                    )}
                    {formattedExifData.lightSource && (
                      <Row
                        label={t('exif.light.source.type')}
                        value={formattedExifData.lightSource}
                      />
                    )}
                  </div>
                </div>
              )}

              {formattedExifData.fujiRecipe && (
                <div>
                  <h4 className="my-2 text-sm font-medium text-white/80">
                    {t('exif.fuji.film.simulation')}
                  </h4>
                  <div className="space-y-1 text-sm">
                    {formattedExifData.fujiRecipe.FilmMode && (
                      <Row
                        label={t('exif.film.mode')}
                        value={formattedExifData.fujiRecipe.FilmMode}
                      />
                    )}
                    {formattedExifData.fujiRecipe.DynamicRange && (
                      <Row
                        label={t('exif.dynamic.range')}
                        value={formattedExifData.fujiRecipe.DynamicRange}
                      />
                    )}
                    {formattedExifData.fujiRecipe.WhiteBalance && (
                      <Row
                        label={t('exif.white.balance.title')}
                        value={formattedExifData.fujiRecipe.WhiteBalance}
                      />
                    )}
                    {formattedExifData.fujiRecipe.HighlightTone && (
                      <Row
                        label={t('exif.highlight.tone')}
                        value={formattedExifData.fujiRecipe.HighlightTone}
                      />
                    )}
                    {formattedExifData.fujiRecipe.ShadowTone && (
                      <Row
                        label={t('exif.shadow.tone')}
                        value={formattedExifData.fujiRecipe.ShadowTone}
                      />
                    )}
                    {formattedExifData.fujiRecipe.Saturation && (
                      <Row
                        label={t('exif.saturation')}
                        value={formattedExifData.fujiRecipe.Saturation}
                      />
                    )}
                    {formattedExifData.fujiRecipe.Sharpness && (
                      <Row
                        label={t('exif.sharpness')}
                        value={formattedExifData.fujiRecipe.Sharpness}
                      />
                    )}
                    {formattedExifData.fujiRecipe.NoiseReduction && (
                      <Row
                        label={t('exif.noise.reduction')}
                        value={formattedExifData.fujiRecipe.NoiseReduction}
                      />
                    )}
                    {formattedExifData.fujiRecipe.Clarity && (
                      <Row
                        label={t('exif.clarity')}
                        value={formattedExifData.fujiRecipe.Clarity}
                      />
                    )}
                    {formattedExifData.fujiRecipe.ColorChromeEffect && (
                      <Row
                        label={t('exif.color.effect')}
                        value={formattedExifData.fujiRecipe.ColorChromeEffect}
                      />
                    )}
                    {formattedExifData.fujiRecipe.ColorChromeFxBlue && (
                      <Row
                        label={t('exif.blue.color.effect')}
                        value={formattedExifData.fujiRecipe.ColorChromeFxBlue}
                      />
                    )}
                    {(formattedExifData.fujiRecipe.GrainEffectRoughness ||
                      formattedExifData.fujiRecipe.GrainEffectSize) && (
                      <>
                        {formattedExifData.fujiRecipe.GrainEffectRoughness && (
                          <Row
                            label={t('exif.grain.effect.intensity')}
                            value={
                              formattedExifData.fujiRecipe.GrainEffectRoughness
                            }
                          />
                        )}
                        {formattedExifData.fujiRecipe.GrainEffectSize && (
                          <Row
                            label={t('exif.grain.effect.size')}
                            value={formattedExifData.fujiRecipe.GrainEffectSize}
                          />
                        )}
                      </>
                    )}
                    {(formattedExifData.fujiRecipe.Red ||
                      formattedExifData.fujiRecipe.Blue) && (
                      <>
                        {formattedExifData.fujiRecipe.Red && (
                          <Row
                            label={t('exif.red.adjustment')}
                            value={formattedExifData.fujiRecipe.Red}
                          />
                        )}
                        {formattedExifData.fujiRecipe.Blue && (
                          <Row
                            label={t('exif.blue.adjustment')}
                            value={formattedExifData.fujiRecipe.Blue}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
              {formattedExifData.gps && (
                <div>
                  <h4 className="my-2 text-sm font-medium text-white/80">
                    {t('exif.gps.location.info')}
                  </h4>
                  <div className="space-y-1 text-sm">
                    <Row
                      label={t('exif.gps.latitude')}
                      value={formattedExifData.gps.latitude}
                    />
                    <Row
                      label={t('exif.gps.longitude')}
                      value={formattedExifData.gps.longitude}
                    />
                    {formattedExifData.gps.altitude && (
                      <Row
                        label={t('exif.gps.altitude')}
                        value={`${formattedExifData.gps.altitude}m`}
                      />
                    )}
                    <div className="mt-2 text-right">
                      <a
                        href={`https://uri.amap.com/marker?position=${formattedExifData.gps.longitude},${formattedExifData.gps.latitude}&name=${encodeURIComponent(t('exif.gps.location.name'))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue inline-flex items-center gap-1 text-xs underline transition-colors hover:text-blue-300"
                      >
                        {t('exif.gps.view.map')}
                        <i className="i-mingcute-external-link-line" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* 新增：技术参数 */}
              {(formattedExifData.brightnessValue ||
                formattedExifData.shutterSpeedValue ||
                formattedExifData.apertureValue ||
                formattedExifData.sensingMethod ||
                formattedExifData.customRendered ||
                formattedExifData.focalPlaneXResolution ||
                formattedExifData.focalPlaneYResolution) && (
                <div>
                  <h4 className="my-2 text-sm font-medium text-white/80">
                    {t('exif.technical.parameters')}
                  </h4>
                  <div className="space-y-1 text-sm">
                    {formattedExifData.brightnessValue && (
                      <Row
                        label={t('exif.brightness.value')}
                        value={formattedExifData.brightnessValue}
                      />
                    )}
                    {formattedExifData.shutterSpeedValue && (
                      <Row
                        label={t('exif.shutter.speed.value')}
                        value={formattedExifData.shutterSpeedValue}
                      />
                    )}
                    {formattedExifData.apertureValue && (
                      <Row
                        label={t('exif.aperture.value')}
                        value={formattedExifData.apertureValue}
                      />
                    )}
                    {formattedExifData.sensingMethod && (
                      <Row
                        label={t('exif.sensing.method.type')}
                        value={formattedExifData.sensingMethod}
                      />
                    )}
                    {formattedExifData.customRendered && (
                      <Row
                        label={t('exif.custom.rendered.type')}
                        value={formattedExifData.customRendered}
                      />
                    )}
                    {(formattedExifData.focalPlaneXResolution ||
                      formattedExifData.focalPlaneYResolution) && (
                      <Row
                        label={t('exif.focal.plane.resolution')}
                        value={`${formattedExifData.focalPlaneXResolution || 'N/A'} × ${formattedExifData.focalPlaneYResolution || 'N/A'}${formattedExifData.focalPlaneResolutionUnit ? ` (${formattedExifData.focalPlaneResolutionUnit})` : ''}`}
                      />
                    )}
                  </div>
                </div>
              )}
            </Fragment>
          )}
        </div>
      </ScrollArea>
    </m.div>
  )
}

const formatExifData = (exif: Exif | null, t: any) => {
  if (!exif) return null

  const photo = exif.Photo || {}
  const image = exif.Image || {}
  const gps = exif.GPSInfo || {}

  // 等效焦距 (35mm)
  const focalLength35mm = photo.FocalLengthIn35mmFilm
    ? Math.round(photo.FocalLengthIn35mmFilm)
    : null

  // 实际焦距
  const focalLength = photo.FocalLength ? Math.round(photo.FocalLength) : null

  // ISO
  const iso = photo.ISOSpeedRatings || image.ISOSpeedRatings

  // 快门速度
  const exposureTime = photo.ExposureTime
  const shutterSpeed = exposureTime
    ? exposureTime >= 1
      ? `${exposureTime}s`
      : `1/${Math.round(1 / exposureTime)}`
    : null

  // 光圈
  const aperture = photo.FNumber ? `f/${photo.FNumber}` : null

  // 最大光圈
  const maxAperture = photo.MaxApertureValue
    ? `${Math.round(Math.pow(Math.sqrt(2), photo.MaxApertureValue) * 10) / 10}`
    : null

  // 相机信息
  const camera =
    image.Make && image.Model ? `${image.Make} ${image.Model}` : null

  // 镜头信息
  const lens =
    photo.LensModel || photo.LensSpecification || photo.LensMake || null

  // 软件信息
  const software = image.Software || null

  const offsetTimeOriginal = photo.OffsetTimeOriginal || photo.OffsetTime
  // 拍摄时间
  const dateTime: string | null = (() => {
    const originalDateTimeStr =
      (photo.DateTimeOriginal as unknown as string) ||
      (photo.DateTime as unknown as string)

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

  // 曝光模式
  const exposureModeMap: Record<number, string> = {
    0: t('exif.exposure.mode.auto'),
    1: t('exif.exposure.mode.manual'),
    2: t('exif.exposure.mode.bracket'),
  }
  const exposureMode =
    photo.ExposureMode !== undefined
      ? exposureModeMap[photo.ExposureMode] ||
        `${t('exif.unknown')} (${photo.ExposureMode})`
      : null

  // 测光模式
  const meteringModeMap: Record<number, string> = {
    0: t('exif.metering.mode.unknown'),
    1: t('exif.metering.mode.average'),
    2: t('exif.metering.mode.center'),
    3: t('exif.metering.mode.spot'),
    4: t('exif.metering.mode.multi'),
    5: t('exif.metering.mode.pattern'),
    6: t('exif.metering.mode.partial'),
  }
  const meteringMode =
    photo.MeteringMode !== undefined
      ? meteringModeMap[photo.MeteringMode] ||
        `${t('exif.unknown')} (${photo.MeteringMode})`
      : null

  // 白平衡
  const whiteBalanceMap: Record<number, string> = {
    0: t('exif.white.balance.auto'),
    1: t('exif.white.balance.manual'),
  }
  const whiteBalance =
    photo.WhiteBalance !== undefined
      ? whiteBalanceMap[photo.WhiteBalance] ||
        `${t('exif.unknown')} (${photo.WhiteBalance})`
      : null

  // 闪光灯
  const flashMap: Record<number, string> = {
    0: t('exif.flash.disabled'),
    1: t('exif.flash.enabled'),
    5: t('exif.flash.disabled.return.detected'),
    7: t('exif.flash.return.detected'),
    9: t('exif.flash.forced.mode'),
    13: t('exif.flash.forced.disabled.return.detected'),
    15: t('exif.flash.forced.return.detected'),
    16: t('exif.flash.off.mode'),
    24: t('exif.flash.auto.no'),
    25: t('exif.flash.auto.yes'),
    29: t('exif.flash.auto.no.return'),
    31: t('exif.flash.auto.return'),
    32: t('exif.flash.unavailable'),
  }
  const flash =
    photo.Flash !== undefined
      ? flashMap[photo.Flash] || `${t('exif.unknown')} (${photo.Flash})`
      : null

  // 数字变焦
  const digitalZoom = photo.DigitalZoomRatio || null

  // 曝光补偿
  const exposureBias = photo.ExposureBiasValue
    ? `${photo.ExposureBiasValue > 0 ? '+' : ''}${photo.ExposureBiasValue.toFixed(1)} EV`
    : null

  // 亮度值
  const brightnessValue = photo.BrightnessValue
    ? `${photo.BrightnessValue.toFixed(1)} EV`
    : null

  // 快门速度值
  const shutterSpeedValue = photo.ShutterSpeedValue
    ? `${photo.ShutterSpeedValue.toFixed(1)} EV`
    : null

  // 光圈值
  const apertureValue = photo.ApertureValue
    ? `${photo.ApertureValue.toFixed(1)} EV`
    : null

  // 光源类型
  const lightSourceMap: Record<number, string> = {
    0: t('exif.light.source.auto'),
    1: t('exif.light.source.daylight.main'),
    2: t('exif.light.source.fluorescent'),
    3: t('exif.light.source.tungsten'),
    4: t('exif.light.source.flash'),
    9: t('exif.light.source.fine.weather'),
    10: t('exif.light.source.cloudy'),
    11: t('exif.light.source.shade'),
    12: t('exif.light.source.daylight.fluorescent'),
    13: t('exif.light.source.day.white.fluorescent'),
    14: t('exif.light.source.cool.white.fluorescent'),
    15: t('exif.light.source.white.fluorescent'),
    17: t('exif.light.source.standard.a'),
    18: t('exif.light.source.standard.b'),
    19: t('exif.light.source.standard.c'),
    20: t('exif.light.source.d55'),
    21: t('exif.light.source.d65'),
    22: t('exif.light.source.d75'),
    23: t('exif.light.source.d50'),
    24: t('exif.light.source.iso.tungsten'),
    255: t('exif.light.source.other'),
  }
  const lightSource =
    photo.LightSource !== undefined
      ? lightSourceMap[photo.LightSource] ||
        `${t('exif.unknown')} (${photo.LightSource})`
      : null

  // 白平衡偏移/微调相关字段
  const whiteBalanceBias = (photo as any).WhiteBalanceBias || null
  const wbShiftAB = (photo as any).WBShiftAB || null
  const wbShiftGM = (photo as any).WBShiftGM || null
  const whiteBalanceFineTune = (photo as any).WhiteBalanceFineTune || null

  // 富士相机特有的白平衡字段
  const wbGRBLevels =
    (photo as any).WBGRBLevels || (photo as any)['WB GRB Levels'] || null
  const wbGRBLevelsStandard =
    (photo as any).WBGRBLevelsStandard ||
    (photo as any)['WB GRB Levels Standard'] ||
    null
  const wbGRBLevelsAuto =
    (photo as any).WBGRBLevelsAuto ||
    (photo as any)['WB GRB Levels Auto'] ||
    null

  // 感光方法
  const sensingMethodMap: Record<number, string> = {
    1: t('exif.sensing.method.undefined'),
    2: t('exif.sensing.method.one.chip'),
    3: t('exif.sensing.method.two.chip'),
    4: t('exif.sensing.method.three.chip'),
    5: t('exif.sensing.method.color.sequential.main'),
    7: t('exif.sensing.method.trilinear'),
    8: t('exif.sensing.method.color.sequential.linear'),
  }
  const sensingMethod =
    photo.SensingMethod !== undefined
      ? sensingMethodMap[photo.SensingMethod] ||
        `${t('exif.unknown')} (${photo.SensingMethod})`
      : null

  // 自定义渲染
  const customRenderedMap: Record<number, string> = {
    0: t('exif.custom.rendered.normal'),
    1: t('exif.custom.rendered.special'),
  }
  const customRendered =
    photo.CustomRendered !== undefined
      ? customRenderedMap[photo.CustomRendered] ||
        `${t('exif.unknown')} (${photo.CustomRendered})`
      : null

  // 焦平面分辨率
  const focalPlaneXResolution = photo.FocalPlaneXResolution
    ? Math.round(photo.FocalPlaneXResolution)
    : null
  const focalPlaneYResolution = photo.FocalPlaneYResolution
    ? Math.round(photo.FocalPlaneYResolution)
    : null

  // 焦平面分辨率单位
  const focalPlaneResolutionUnitMap: Record<number, string> = {
    1: t('exif.resolution.unit.none'),
    2: t('exif.resolution.unit.inches'),
    3: t('exif.resolution.unit.cm'),
  }
  const focalPlaneResolutionUnit =
    photo.FocalPlaneResolutionUnit !== undefined
      ? focalPlaneResolutionUnitMap[photo.FocalPlaneResolutionUnit] ||
        `${t('exif.unknown')} (${photo.FocalPlaneResolutionUnit})`
      : null

  // 像素信息
  const pixelXDimension = photo.PixelXDimension || null
  const pixelYDimension = photo.PixelYDimension || null
  const totalPixels =
    pixelXDimension && pixelYDimension
      ? pixelXDimension * pixelYDimension
      : null
  const megaPixels = totalPixels
    ? `${(totalPixels / 1000000).toFixed(1)}MP`
    : null

  // 色彩空间
  const colorSpaceMap: Record<number, string> = {
    1: 'sRGB',
    65535: 'Adobe RGB',
  }
  const colorSpace =
    photo.ColorSpace !== undefined
      ? colorSpaceMap[photo.ColorSpace] ||
        `${t('exif.unknown')} (${photo.ColorSpace})`
      : null

  // GPS 信息
  let gpsInfo: {
    latitude: string | undefined
    longitude: string | undefined
    altitude: number | null
  } | null = null
  if (gps.GPSLatitude && gps.GPSLongitude) {
    const latitude = convertDMSToDD(gps.GPSLatitude, gps.GPSLatitudeRef || '')
    const longitude = convertDMSToDD(
      gps.GPSLongitude,
      gps.GPSLongitudeRef || '',
    )
    const altitude = gps.GPSAltitude || null

    gpsInfo = {
      latitude: latitude?.toFixed(6),
      longitude: longitude?.toFixed(6),
      altitude: altitude ? Math.round(altitude) : null,
    }
  }

  // 富士相机 Recipe 信息
  const fujiRecipe = (exif as any).FujiRecipe || null

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
    digitalZoom,
    colorSpace,
    gps: gpsInfo,
    exposureBias,
    brightnessValue,
    shutterSpeedValue,
    apertureValue,
    lightSource,
    sensingMethod,
    customRendered,
    focalPlaneXResolution,
    focalPlaneYResolution,
    focalPlaneResolutionUnit,
    megaPixels,
    pixelXDimension,
    pixelYDimension,
    whiteBalanceBias,
    wbShiftAB,
    wbShiftGM,
    whiteBalanceFineTune,
    wbGRBLevels,
    wbGRBLevelsStandard,
    wbGRBLevelsAuto,
    fujiRecipe,
  }
}

// 将度分秒格式转换为十进制度数
const convertDMSToDD = (dms: number[], ref: string): number | null => {
  if (!dms || dms.length !== 3) return null

  const [degrees, minutes, seconds] = dms
  let dd = degrees + minutes / 60 + seconds / 3600

  if (ref === 'S' || ref === 'W') {
    dd = dd * -1
  }

  return dd
}

const Row: FC<{
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
