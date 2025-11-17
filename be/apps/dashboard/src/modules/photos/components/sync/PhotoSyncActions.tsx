import { Button } from '@afilmory/ui'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { usePhotoSyncAutoRunValue, useSetPhotoSyncAutoRun } from '~/atoms/photo-sync'
import { useMainPageLayout } from '~/components/layouts/MainPageLayout'
import { getRequestErrorMessage } from '~/lib/errors'

import { runPhotoSync } from '../../api'
import type { RunPhotoSyncPayload } from '../../types'
import { usePhotoSyncController } from './PhotoSyncControllerContext'

export function PhotoSyncActions() {
  const { onCompleted, onProgress, onError } = usePhotoSyncController()
  const { setHeaderActionState } = useMainPageLayout()
  const [pendingMode, setPendingMode] = useState<'dry-run' | 'apply' | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const autoRunMode = usePhotoSyncAutoRunValue()
  const setAutoRunMode = useSetPhotoSyncAutoRun()

  const mutation = useMutation({
    mutationFn: async (variables: RunPhotoSyncPayload) => {
      const controller = new AbortController()
      abortRef.current = controller

      try {
        return await runPhotoSync(
          { dryRun: variables.dryRun ?? false },
          {
            signal: controller.signal,
            onEvent: onProgress,
          },
        )
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
      }
    },
    onMutate: (variables) => {
      setPendingMode(variables.dryRun ? 'dry-run' : 'apply')
      setHeaderActionState({ disabled: true, loading: true })
    },
    onSuccess: (data, variables) => {
      onCompleted(data, { dryRun: variables.dryRun ?? false })
      const { inserted, updated, conflicts, errors } = data.summary
      toast.success(variables.dryRun ? '同步预览完成' : '照片同步完成', {
        description: `新增 ${inserted} · 更新 ${updated} · 冲突 ${conflicts} · 错误 ${errors}`,
      })
    },
    onError: (error) => {
      const normalizedError = error instanceof Error ? error : new Error('照片同步失败，请稍后重试。')

      const message = getRequestErrorMessage(error, normalizedError.message)
      toast.error('同步失败', { description: message })
      onError(normalizedError)
    },
    onSettled: () => {
      setPendingMode(null)
      setHeaderActionState({ disabled: false, loading: false })
      abortRef.current = null
    },
  })

  const { isPending, mutate } = mutation

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      setHeaderActionState({ disabled: false, loading: false })
    }
  }, [setHeaderActionState])

  useEffect(() => {
    if (!autoRunMode) {
      return
    }
    if (isPending) {
      return
    }
    mutate({ dryRun: autoRunMode === 'dry-run' })
    setAutoRunMode(null)
  }, [autoRunMode, isPending, mutate, setAutoRunMode])

  const handleSync = (dryRun: boolean) => {
    mutation.mutate({ dryRun })
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        isLoading={isPending && pendingMode === 'dry-run'}
        onClick={() => handleSync(true)}
      >
        预览同步
      </Button>
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={isPending}
        isLoading={isPending && pendingMode === 'apply'}
        onClick={() => handleSync(false)}
      >
        同步照片
      </Button>
    </div>
  )
}
