import type { ModalComponent } from '@afilmory/ui'
import { Button, DialogDescription, DialogFooter, DialogHeader, DialogTitle, LinearDivider } from '@afilmory/ui'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { getRequestErrorMessage } from '~/lib/errors'

import { useUpdatePhotoTagsMutation } from '../../hooks'
import type { PhotoAssetListItem } from '../../types'
import { AutoSelect } from './photo-upload/AutoSelect'

type PhotoTagEditorModalProps = {
  assets: PhotoAssetListItem[]
  availableTags: string[]
}

const arraysEqual = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index])

export const PhotoTagEditorModal: ModalComponent<PhotoTagEditorModalProps> = ({ assets, availableTags, dismiss }) => {
  const updateTagsMutation = useUpdatePhotoTagsMutation()
  const [isSaving, setIsSaving] = useState(false)
  const initialTags = useMemo(() => {
    if (assets.length === 0) {
      return []
    }
    if (assets.length === 1) {
      return assets[0].manifest?.data?.tags ?? []
    }
    const firstTags = assets[0].manifest?.data?.tags ?? []
    return firstTags.filter((tag) => assets.every((asset) => (asset.manifest?.data?.tags ?? []).includes(tag)))
  }, [assets])
  const [tags, setTags] = useState<string[]>(initialTags)
  useEffect(() => {
    setTags(initialTags)
  }, [initialTags])

  const isMultiEdit = assets.length > 1
  const tagOptions = useMemo(
    () => availableTags.map((tag) => ({ label: tag, value: tag.toLowerCase() })),
    [availableTags],
  )
  const fileName = useMemo(() => {
    const first = assets[0]
    if (!first) return ''
    const parts = first.storageKey.split('/')
    return parts.at(-1) ?? first.photoId
  }, [assets])
  const nextPathPreview = useMemo(() => {
    if (!fileName) {
      return null
    }
    if (tags.length === 0) {
      return fileName
    }
    return `${tags.join('/')} / ${fileName}`
  }, [fileName, tags])

  const hasChanges = useMemo(() => !arraysEqual(tags, initialTags), [tags, initialTags])
  const isBusy = isSaving || updateTagsMutation.isPending

  const assetTitle = useMemo(() => {
    if (assets.length === 0) return '未选择资源'
    if (!isMultiEdit) {
      const single = assets[0]
      return single.manifest?.data?.title ?? single.photoId
    }
    return `${assets.length} 个资源`
  }, [assets, isMultiEdit])

  const handleSave = async () => {
    if (assets.length === 0) {
      dismiss?.()
      return
    }
    setIsSaving(true)
    try {
      for (const asset of assets) {
        await updateTagsMutation.mutateAsync({ id: asset.id, tags })
      }
      toast.success(isMultiEdit ? `已更新 ${assets.length} 个资源的标签` : '标签已更新', {
        description: '远程存储路径已同步到新的标签目录。',
      })
      dismiss?.()
    } catch (error) {
      toast.error('更新标签失败', {
        description: getRequestErrorMessage(error, '请稍后重试。'),
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>修改「{assetTitle}」的标签</DialogTitle>
        <DialogDescription>
          标签同时决定远程存储的目录结构，
          {isMultiEdit
            ? '所有选中资源都会应用同样的标签。'
            : '调整后将自动移动原图文件（及其 Live Photo 视频）到新的路径。'}
        </DialogDescription>
      </DialogHeader>

      {nextPathPreview ? (
        <div className="space-y-2 rounded-md border border-border/60 bg-background/60 p-3 text-xs text-text-tertiary">
          <div className="flex items-center justify-between text-[11px] font-medium text-text">
            <span>{isMultiEdit ? '示例存储路径（第一项）' : '新存储路径预览'}</span>
            <span className="text-text-secondary">（基于标签顺序）</span>
          </div>
          <p className="text-text rounded bg-background-secondary/60 px-2 py-1 font-mono text-xs">{nextPathPreview}</p>
        </div>
      ) : null}

      <AutoSelect
        options={tagOptions}
        value={tags}
        onChange={setTags}
        placeholder="输入后按 Enter 添加，或从常用标签中选择"
        disabled={isBusy}
      />

      <LinearDivider />

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={dismiss}
          className="text-text-secondary hover:text-text"
        >
          取消
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!hasChanges || isBusy}
          onClick={() => void handleSave()}
        >
          {isBusy ? '保存中…' : '保存'}
        </Button>
      </DialogFooter>
    </div>
  )
}

PhotoTagEditorModal.contentClassName = 'w-[min(520px,92vw)]'
