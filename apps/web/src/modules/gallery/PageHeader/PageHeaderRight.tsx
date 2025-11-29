import { useAtom, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { gallerySettingAtom, isCommandPaletteOpenAtom } from '~/atoms/app'
import { useMobile } from '~/hooks/useMobile'

import { ResponsiveActionButton } from '../components/ActionButton'
import { ViewPanel } from '../panels/ViewPanel'
import { ActionIconButton } from './utils'

export const PageHeaderRight = () => {
  const { t } = useTranslation()
  const isMobile = useMobile()
  const [gallerySetting] = useAtom(gallerySettingAtom)
  const setCommandPaletteOpen = useSetAtom(isCommandPaletteOpenAtom)
  const navigate = useNavigate()

  // 计算视图设置是否有自定义配置
  const hasViewCustomization = gallerySetting.columns !== 'auto' || gallerySetting.sortOrder !== 'desc'

  // 计算过滤器数量
  const filterCount =
    gallerySetting.selectedTags.length +
    gallerySetting.selectedCameras.length +
    gallerySetting.selectedLenses.length +
    (gallerySetting.selectedRatings !== null ? 1 : 0)

  return (
    <div className="flex items-center gap-1.5 lg:gap-2">
      {/* Action Buttons */}
      <ActionIconButton
        icon="i-mingcute-search-line"
        title={t('action.search.unified.title')}
        onClick={() => setCommandPaletteOpen(true)}
        badge={filterCount}
      />

      {/* Desktop only: Map Link */}
      {!isMobile && (
        <ActionIconButton
          icon="i-mingcute-map-pin-line"
          title={t('action.map.explore')}
          onClick={() => navigate('/explory')}
        />
      )}

      <ResponsiveActionButton
        icon="i-mingcute-layout-grid-line"
        title={t('action.view.title')}
        badge={hasViewCustomization ? '●' : undefined}
      >
        <ViewPanel />
      </ResponsiveActionButton>
    </div>
  )
}
