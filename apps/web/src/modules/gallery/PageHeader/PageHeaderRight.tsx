import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@afilmory/ui'
import { useAtom, useSetAtom } from 'jotai'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Drawer } from 'vaul'

import { gallerySettingAtom, isCommandPaletteOpenAtom } from '~/atoms/app'
import { useMobile } from '~/hooks/useMobile'

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
    <div className="flex items-center gap-1 rounded-lg bg-white/5 lg:gap-1.5">
      {/* Action Buttons */}
      <div className="border-border flex items-center gap-1 rounded-lg border-[0.5px]">
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

        {isMobile ? (
          <MobileViewButton
            icon="i-mingcute-layout-grid-line"
            title={t('action.view.title')}
            badge={hasViewCustomization ? '●' : undefined}
          >
            <ViewPanel />
          </MobileViewButton>
        ) : (
          <DesktopViewButton
            icon="i-mingcute-layout-grid-line"
            title={t('action.view.title')}
            badge={hasViewCustomization ? '●' : undefined}
          >
            <ViewPanel />
          </DesktopViewButton>
        )}
      </div>
    </div>
  )
}

// 紧凑版本的桌面端视图按钮
const DesktopViewButton = ({
  icon,
  title,
  badge,
  children,
}: {
  icon: string
  title: string
  badge?: number | string
  children: React.ReactNode
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex size-7 items-center justify-center rounded text-white/60 transition-all duration-200 hover:bg-white/10 hover:text-white lg:size-8"
          title={title}
        >
          <i className={`${icon} text-sm lg:text-base`} />
          {badge && (
            <span className="absolute -top-0.5 -right-0.5 flex size-2 items-center justify-center rounded-full bg-blue-500 lg:size-2.5">
              <span className="sr-only">{badge}</span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

// 紧凑版本的移动端视图按钮
const MobileViewButton = ({
  icon,
  title,
  badge,
  children,
}: {
  icon: string
  title: string
  badge?: number | string
  children: React.ReactNode
}) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="relative flex size-7 items-center justify-center rounded text-white/60 transition-all duration-200 hover:bg-white/10 hover:text-white lg:size-8"
        title={title}
        onClick={() => setOpen(!open)}
      >
        <i className={`${icon} text-sm lg:text-base`} />
        {badge && (
          <span className="absolute -top-0.5 -right-0.5 flex size-2 items-center justify-center rounded-full bg-blue-500 lg:size-2.5">
            <span className="sr-only">{badge}</span>
          </span>
        )}
      </button>
      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" />
          <Drawer.Content className="fixed right-0 bottom-0 left-0 z-50 flex flex-col rounded-t-2xl border-t border-zinc-200 bg-white/80 p-4 backdrop-blur-xl dark:border-zinc-800 dark:bg-black/80">
            <div className="mx-auto mb-4 h-1.5 w-12 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            {children}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}
