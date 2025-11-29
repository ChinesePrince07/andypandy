import { Spring } from '@afilmory/utils'
import { useAtom } from 'jotai'
import { m as motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import type { GalleryViewMode } from '~/atoms/app'
import { gallerySettingAtom } from '~/atoms/app'

export const ViewModeSegment = () => {
  const { t } = useTranslation()
  const [settings, setSettings] = useAtom(gallerySettingAtom)

  const handleViewModeChange = (mode: GalleryViewMode) => {
    setSettings((prev) => ({ ...prev, viewMode: mode }))
  }

  return (
    <div className="relative flex h-9 items-center gap-0.5 rounded-full bg-white/5 p-0.5 lg:h-10 lg:gap-1 lg:p-1">
      <button
        type="button"
        onClick={() => handleViewModeChange('masonry')}
        className={`relative z-10 flex h-full items-center gap-1.5 rounded-full px-2.5 text-sm font-medium transition-colors duration-200 lg:px-3 ${
          settings.viewMode === 'masonry' ? 'text-white' : 'text-white/60 hover:text-white/80'
        }`}
        title={t('gallery.view.masonry')}
      >
        {settings.viewMode === 'masonry' && (
          <motion.span
            layoutId="segment-indicator"
            className="absolute inset-0 rounded-full bg-white/15 shadow-sm"
            transition={Spring.presets.snappy}
          />
        )}
        <i className="i-mingcute-grid-line relative z-10 text-sm lg:text-base" />
        <span className="relative z-10 hidden lg:inline">{t('gallery.view.masonry')}</span>
      </button>
      <button
        type="button"
        onClick={() => handleViewModeChange('list')}
        className={`relative z-10 flex h-full items-center gap-1.5 rounded-full px-2.5 text-sm font-medium transition-colors duration-200 lg:px-3 ${
          settings.viewMode === 'list' ? 'text-white' : 'text-white/60 hover:text-white/80'
        }`}
        title={t('gallery.view.list')}
      >
        {settings.viewMode === 'list' && (
          <motion.span
            layoutId="segment-indicator"
            className="absolute inset-0 rounded-full bg-white/15 shadow-sm"
            transition={Spring.presets.snappy}
          />
        )}
        <i className="i-mingcute-list-ordered-line relative z-10 text-sm lg:text-base" />
        <span className="relative z-10 hidden lg:inline">{t('gallery.view.list')}</span>
      </button>
    </div>
  )
}
