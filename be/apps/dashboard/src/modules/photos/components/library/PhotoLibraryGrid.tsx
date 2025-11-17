import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Modal,
  Prompt,
  Thumbhash,
} from '@afilmory/ui'
import { clsxm } from '@afilmory/utils'
import { useAtomValue } from 'jotai'
import { DynamicIcon } from 'lucide-react/dynamic'
import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useShallow } from 'zustand/shallow'

import { viewportAtom } from '~/atoms/viewport'
import { LinearBorderPanel } from '~/components/common/GlassPanel'
import { stopPropagation } from '~/lib/dom'

import type { PhotoAssetListItem } from '../../types'
import { DeleteFromStorageOption } from './DeleteFromStorageOption'
import { Masonry } from './Masonry'
import { PhotoExifDetailsModal } from './PhotoExifDetailsModal'
import { usePhotoLibraryStore } from './PhotoLibraryProvider'
import { PhotoTagEditorModal } from './PhotoTagEditorModal'
import type { DeleteAssetOptions } from './types'

type PhotoLibrarySortBy = 'uploadedAt' | 'capturedAt'
type PhotoLibrarySortOrder = 'desc' | 'asc'

const SORT_BY_OPTIONS: { value: PhotoLibrarySortBy; label: string; icon: string }[] = [
  { value: 'uploadedAt', label: '按上传时间', icon: 'upload' },
  { value: 'capturedAt', label: '按拍摄时间', icon: 'camera' },
]

const SORT_ORDER_OPTIONS: { value: PhotoLibrarySortOrder; label: string; icon: string }[] = [
  { value: 'desc', label: '最新优先', icon: 'arrow-down' },
  { value: 'asc', label: '最早优先', icon: 'arrow-up' },
]

function parseDate(value?: string | number | null) {
  if (!value) return 0
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function getSortTimestamp(asset: PhotoAssetListItem, sortBy: PhotoLibrarySortBy) {
  if (sortBy === 'capturedAt') {
    return parseDate(asset.manifest?.data?.dateTaken) || parseDate(asset.manifest?.data?.exif?.DateTimeOriginal)
  }
  return parseDate(asset.createdAt)
}

function PhotoGridItem({
  asset,
  isSelected,
  onToggleSelect,
  onOpenAsset,
  onDeleteAsset,
  onEditTags,
  isDeleting,
}: {
  asset: PhotoAssetListItem
  isSelected: boolean
  onToggleSelect: (id: string) => void
  onOpenAsset: (asset: PhotoAssetListItem) => void
  onDeleteAsset: (asset: PhotoAssetListItem, options?: DeleteAssetOptions) => Promise<void> | void
  onEditTags: (asset: PhotoAssetListItem) => void
  isDeleting?: boolean
}) {
  const manifest = asset.manifest?.data
  const previewUrl = manifest?.thumbnailUrl ?? manifest?.originalUrl ?? asset.publicUrl
  const deviceLabel = manifest?.exif?.Model || manifest?.exif?.Make || '未知设备'
  const updatedAtLabel = new Date(asset.updatedAt).toLocaleString()
  const fileSizeLabel =
    asset.size !== null && asset.size !== undefined
      ? `${(asset.size / (1024 * 1024)).toFixed(2)} MB`
      : manifest?.size
        ? `${(manifest.size / (1024 * 1024)).toFixed(2)} MB`
        : '未知大小'
  const assetLabel = manifest?.title ?? manifest?.id ?? asset.photoId

  const handleDelete = () => {
    let deleteFromStorage = false

    Prompt.prompt({
      title: '确认删除该资源？',
      description: `删除后将无法恢复，是否继续删除「${assetLabel}」？如需同时删除远程存储文件，可勾选下方选项。`,
      variant: 'danger',
      onConfirmText: '删除',
      onCancelText: '取消',
      content: (
        <DeleteFromStorageOption
          onChange={(checked) => {
            deleteFromStorage = checked
          }}
        />
      ),
      onConfirm: () => Promise.resolve(onDeleteAsset(asset, { deleteFromStorage })),
    })
  }
  const handleViewExif = () => {
    if (!manifest) return

    Modal.present(PhotoExifDetailsModal, {
      manifest,
    })
  }

  return (
    <div
      className={clsxm(
        'relative group overflow-hidden bg-background-secondary/40 transition-all duration-200',
        isSelected && 'ring-2 ring-accent/80',
      )}
    >
      {previewUrl ? (
        <div
          className="relative w-full"
          style={manifest?.aspectRatio ? { aspectRatio: manifest.aspectRatio } : undefined}
        >
          {manifest?.thumbHash && <Thumbhash thumbHash={manifest.thumbHash} className="absolute inset-0" />}
          <img
            src={previewUrl}
            alt={manifest?.id ?? asset.photoId}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>
      ) : (
        <div
          className="relative w-full"
          style={manifest?.aspectRatio ? { aspectRatio: manifest.aspectRatio } : undefined}
        >
          {manifest?.thumbHash ? (
            <Thumbhash thumbHash={manifest.thumbHash} className="absolute inset-0" />
          ) : (
            <div className="bg-background-secondary/80 text-text-tertiary flex h-48 w-full items-center justify-center">
              无法预览
            </div>
          )}
        </div>
      )}

      <div
        role="button"
        onClick={() => onToggleSelect(asset.id)}
        className="bg-background/5 absolute inset-0 flex flex-col justify-between opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100"
      >
        <div className="flex items-start justify-between p-3 text-xs text-white">
          <div className="max-w-[70%] truncate font-medium">{manifest?.title ?? manifest?.id ?? asset.photoId}</div>
          <div
            className={clsxm(
              'inline-flex items-center rounded-full border border-white/30 bg-black/40 px-2 py-1 text-[10px] uppercase tracking-wide text-white transition-colors',
              isSelected ? 'bg-accent text-white' : 'hover:bg-white/10',
            )}
          >
            <DynamicIcon name={isSelected ? 'check' : 'square'} className="mr-1 h-3 w-3" />
            <span>{isSelected ? '已选择' : '选择'}</span>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3 p-3">
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] text-white/80">
              <DynamicIcon name="camera" className="h-3 w-3 shrink-0 text-white/60" />
              <span className="truncate">{deviceLabel}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-white/80">
              <DynamicIcon name="clock" className="h-3 w-3 shrink-0 text-white/60" />
              <span className="truncate">{updatedAtLabel}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-white/80">
              <DynamicIcon name="hard-drive" className="h-3 w-3 shrink-0 text-white/60" />
              <span className="truncate">{fileSizeLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0" onClick={stopPropagation} tabIndex={-1}>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="bg-black/40 text-white hover:bg-black/60 h-7 px-2.5"
              onClick={() => onOpenAsset(asset)}
            >
              <DynamicIcon name="external-link" className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="bg-black/40 text-white hover:bg-black/60 h-7 px-2.5"
                >
                  <DynamicIcon name="more-horizontal" className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                <DropdownMenuItem
                  icon={<DynamicIcon name="tags" className="size-4" />}
                  onSelect={() => onEditTags(asset)}
                >
                  编辑标签
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={<DynamicIcon name="info" className="size-4" />}
                  disabled={!manifest}
                  onSelect={handleViewExif}
                >
                  查看 EXIF
                </DropdownMenuItem>
                <div className="h-[0.5px] bg-border my-1" />
                <DropdownMenuItem
                  icon={<DynamicIcon name="trash-2" className="size-4" />}
                  disabled={isDeleting}
                  onSelect={handleDelete}
                  className="text-red focus:text-red focus:bg-red/10"
                >
                  删除资源
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PhotoLibraryGrid() {
  const viewport = useAtomValue(viewportAtom)
  const columnWidth = viewport.sm ? 320 : 160
  const [sortBy, setSortBy] = useState<PhotoLibrarySortBy>('uploadedAt')
  const [sortOrder, setSortOrder] = useState<PhotoLibrarySortOrder>('desc')
  const { assets, isLoading, selectedIds, toggleSelect, openAsset, deleteAsset, availableTags, isDeleting } =
    usePhotoLibraryStore(
      useShallow((state) => ({
        assets: state.assets,
        isLoading: state.isLoading,
        selectedIds: state.selectedIds,
        toggleSelect: state.toggleSelect,
        openAsset: state.openAsset,
        deleteAsset: state.deleteAsset,
        isDeleting: state.isDeleting,
        availableTags: state.availableTags,
      })),
    )
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const handleEditTags = useCallback(
    (asset: PhotoAssetListItem) => {
      Modal.present(PhotoTagEditorModal, {
        assets: [asset],
        availableTags,
      })
    },
    [availableTags],
  )

  const sortedAssets = useMemo(() => {
    if (!assets) return
    return assets.toSorted((a, b) => {
      const diff = getSortTimestamp(b, sortBy) - getSortTimestamp(a, sortBy)
      return sortOrder === 'desc' ? diff : -diff
    })
  }, [assets, sortBy, sortOrder])

  let content: ReactNode

  if (isLoading) {
    content = (
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {Array.from({ length: 6 }, (_, i) => `photo-skeleton-${i + 1}`).map((key) => (
          <div key={key} className="mb-4 break-inside-avoid">
            <div className="bg-fill/30 h-48 w-full animate-pulse rounded-xl" />
          </div>
        ))}
      </div>
    )
  } else if (!sortedAssets || sortedAssets.length === 0) {
    content = (
      <LinearBorderPanel className="bg-background-tertiary relative overflow-hidden p-4 sm:p-8 text-center">
        <p className="text-text text-sm sm:text-base font-semibold">当前没有图片资源</p>
        <p className="text-text-tertiary mt-2 text-xs sm:text-sm">使用右上角的"上传图片"按钮可以为图库添加新的照片。</p>
      </LinearBorderPanel>
    )
  } else {
    content = (
      <div className="lg:mx-[calc(calc((3rem+100vw)-(var(--container-7xl)))*-1/2)] -mx-2 lg:mt-0 mt-12 p-1">
        <Masonry
          items={sortedAssets}
          columnGutter={8}
          columnWidth={columnWidth}
          itemKey={(asset) => asset.id}
          render={({ data }) => (
            <PhotoGridItem
              asset={data}
              isSelected={selectedSet.has(data.id)}
              onToggleSelect={toggleSelect}
              onOpenAsset={openAsset}
              onDeleteAsset={deleteAsset}
              onEditTags={handleEditTags}
              isDeleting={isDeleting}
            />
          )}
        />
      </div>
    )
  }

  const currentSortBy = SORT_BY_OPTIONS.find((option) => option.value === sortBy) ?? SORT_BY_OPTIONS[0]
  const currentSortOrder = SORT_ORDER_OPTIONS.find((option) => option.value === sortOrder) ?? SORT_ORDER_OPTIONS[0]

  return (
    <div className="space-y-3 relative">
      <div className="flex flex-wrap items-center justify-end gap-2 text-xs absolute lg:translate-y-[-50px] -translate-y-10 -translate-x-2 lg:translate-x-0 lg:right-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="hover:bg-background-secondary/70 flex items-center gap-1.5 rounded-full border px-3 h-8 text-text"
            >
              <DynamicIcon name={currentSortBy.icon as any} className="size-4" />
              <span className="font-medium">{currentSortBy.label}</span>
              <DynamicIcon name="chevron-down" className="h-3 w-3 text-text-tertiary" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            {SORT_BY_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                active={option.value === sortBy}
                icon={<DynamicIcon name={option.icon as any} className="size-4" />}
                onSelect={() => setSortBy(option.value)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="hover:bg-background-secondary/70 flex items-center gap-1.5 rounded-full border px-3 h-8 text-text"
            >
              <DynamicIcon name={currentSortOrder.icon as any} className="size-4" />
              <span className="font-medium">{currentSortOrder.label}</span>
              <DynamicIcon name="chevron-down" className="h-3 w-3 text-text-tertiary" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            {SORT_ORDER_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.value}
                active={option.value === sortOrder}
                icon={<DynamicIcon name={option.icon as any} className="size-4" />}
                onSelect={() => setSortOrder(option.value)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {content}
    </div>
  )
}
