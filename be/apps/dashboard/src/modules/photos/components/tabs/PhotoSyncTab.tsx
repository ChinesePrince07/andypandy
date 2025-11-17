import { useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { getRequestErrorMessage } from '~/lib/errors'

import { getPhotoStorageUrl } from '../../api'
import {
  PHOTO_ASSET_LIST_QUERY_KEY,
  usePhotoAssetSummaryQuery,
  usePhotoSyncConflictsQuery,
  usePhotoSyncStatusQuery,
  useResolvePhotoSyncConflictMutation,
} from '../../hooks'
import type {
  PhotoSyncConflict,
  PhotoSyncProgressEvent,
  PhotoSyncProgressStage,
  PhotoSyncProgressState,
  PhotoSyncResolution,
  PhotoSyncResult,
} from '../../types'
import { PhotoPageScaffold } from '../PhotoPageScaffold'
import { PhotoSyncConflictsPanel } from '../sync/PhotoSyncConflictsPanel'
import { PhotoSyncControllerProvider } from '../sync/PhotoSyncControllerContext'
import { PhotoSyncProgressPanel } from '../sync/PhotoSyncProgressPanel'
import { PhotoSyncResultPanel } from '../sync/PhotoSyncResultPanel'

const BATCH_RESOLVING_ID = '__batch__'
const MAX_SYNC_LOGS = 200
const STAGE_ORDER: PhotoSyncProgressStage[] = [
  'missing-in-db',
  'orphan-in-db',
  'metadata-conflicts',
  'status-reconciliation',
]

function createInitialStages(totals: PhotoSyncProgressState['totals']): PhotoSyncProgressState['stages'] {
  return STAGE_ORDER.reduce<PhotoSyncProgressState['stages']>(
    (acc, stage) => {
      const total = totals[stage]
      acc[stage] = {
        status: total === 0 ? 'completed' : 'pending',
        processed: 0,
        total,
      }
      return acc
    },
    {} as PhotoSyncProgressState['stages'],
  )
}

export function PhotoSyncTab() {
  const queryClient = useQueryClient()
  const [result, setResult] = useState<PhotoSyncResult | null>(null)
  const [lastWasDryRun, setLastWasDryRun] = useState<boolean | null>(null)
  const [resolvingConflictId, setResolvingConflictId] = useState<string | null>(null)
  const [syncProgress, setSyncProgress] = useState<PhotoSyncProgressState | null>(null)

  const summaryQuery = usePhotoAssetSummaryQuery()
  const {
    data: syncStatus,
    isLoading: isSyncStatusLoading,
    isFetching: isSyncStatusFetching,
    refetch: refetchSyncStatus,
  } = usePhotoSyncStatusQuery()
  const conflictsQuery = usePhotoSyncConflictsQuery()
  const resolveConflictMutation = useResolvePhotoSyncConflictMutation()

  const handleProgressEvent = useCallback((event: PhotoSyncProgressEvent) => {
    if (event.type === 'start') {
      const { summary, totals, options } = event.payload
      setSyncProgress({
        dryRun: options.dryRun,
        summary,
        totals,
        stages: createInitialStages(totals),
        startedAt: Date.now(),
        updatedAt: Date.now(),
        logs: [],
        lastAction: undefined,
        error: undefined,
      })
      setLastWasDryRun(options.dryRun)
      return
    }

    if (event.type === 'complete') {
      setSyncProgress(null)
      return
    }

    if (event.type === 'error') {
      setSyncProgress((prev) =>
        prev
          ? {
              ...prev,
              error: event.payload.message,
              updatedAt: Date.now(),
            }
          : prev,
      )
      return
    }

    if (event.type === 'log') {
      setSyncProgress((prev) => {
        if (!prev) {
          return prev
        }

        const parsedTimestamp = Date.parse(event.payload.timestamp)
        const entry = {
          id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Number.isNaN(parsedTimestamp) ? Date.now() : parsedTimestamp,
          level: event.payload.level,
          message: event.payload.message,
          stage: event.payload.stage ?? null,
          storageKey: event.payload.storageKey ?? undefined,
          details: event.payload.details ?? null,
        }

        const nextLogs = prev.logs.length >= MAX_SYNC_LOGS ? [...prev.logs.slice(1), entry] : [...prev.logs, entry]

        return {
          ...prev,
          logs: nextLogs,
          updatedAt: Date.now(),
        }
      })
      return
    }

    if (event.type === 'stage') {
      setSyncProgress((prev) => {
        if (!prev) {
          return prev
        }

        const { stage, status, processed, total, summary } = event.payload
        const nextStages = {
          ...prev.stages,
          [stage]: {
            status: status === 'complete' ? 'completed' : total === 0 ? 'completed' : 'running',
            processed,
            total,
          },
        }

        return {
          ...prev,
          summary,
          stages: nextStages,
          updatedAt: Date.now(),
        }
      })
      return
    }

    if (event.type === 'action') {
      setSyncProgress((prev) => {
        if (!prev) {
          return prev
        }

        const { stage, index, total, action, summary } = event.payload
        const nextStages = {
          ...prev.stages,
          [stage]: {
            status: total === 0 ? 'completed' : 'running',
            processed: index,
            total,
          },
        }

        return {
          ...prev,
          summary,
          stages: nextStages,
          lastAction: {
            stage,
            index,
            total,
            action,
          },
          updatedAt: Date.now(),
        }
      })
    }
  }, [])

  const handleSyncError = useCallback((error: Error) => {
    setSyncProgress((prev) =>
      prev
        ? {
            ...prev,
            error: error.message,
            updatedAt: Date.now(),
          }
        : prev,
    )
  }, [])

  const handleSyncCompleted = useCallback(
    (data: PhotoSyncResult, context: { dryRun: boolean }) => {
      setResult(data)
      setLastWasDryRun(context.dryRun)
      setSyncProgress(null)

      void summaryQuery.refetch()
      void refetchSyncStatus()
      void queryClient.invalidateQueries({ queryKey: PHOTO_ASSET_LIST_QUERY_KEY })
      if (data.summary.conflicts > 0) {
        void conflictsQuery.refetch()
      }
    },
    [summaryQuery, refetchSyncStatus, conflictsQuery, queryClient],
  )

  const handleResolveConflict = useCallback(
    async (conflict: PhotoSyncConflict, strategy: PhotoSyncResolution) => {
      if (!strategy) {
        return
      }
      setResolvingConflictId(conflict.id)
      try {
        const action = await resolveConflictMutation.mutateAsync({
          id: conflict.id,
          strategy,
        })
        toast.success('冲突已处理', {
          description:
            action.reason ??
            (strategy === 'prefer-storage' ? '已以存储数据覆盖数据库记录。' : '已保留数据库记录并忽略存储差异。'),
        })
        void conflictsQuery.refetch()
        void summaryQuery.refetch()
        void queryClient.invalidateQueries({ queryKey: PHOTO_ASSET_LIST_QUERY_KEY })
      } catch (error) {
        const message = getRequestErrorMessage(error, '处理冲突失败，请稍后重试。')
        toast.error('处理冲突失败', { description: message })
      } finally {
        setResolvingConflictId(null)
      }
    },
    [conflictsQuery, resolveConflictMutation, summaryQuery, queryClient],
  )

  const handleResolveConflictsBatch = useCallback(
    async (conflicts: PhotoSyncConflict[], strategy: PhotoSyncResolution) => {
      if (!strategy || conflicts.length === 0) {
        toast.info('请选择至少一个冲突条目')
        return
      }

      setResolvingConflictId(BATCH_RESOLVING_ID)
      let processed = 0
      const errors: string[] = []

      try {
        for (const conflict of conflicts) {
          try {
            await resolveConflictMutation.mutateAsync({
              id: conflict.id,
              strategy,
            })
            processed += 1
          } catch (error) {
            errors.push(getRequestErrorMessage(error, '处理冲突失败，请稍后重试。'))
          }
        }
      } finally {
        setResolvingConflictId(null)
      }

      if (processed > 0) {
        toast.success(`${strategy === 'prefer-storage' ? '以存储为准' : '以数据库为准'}处理 ${processed} 个冲突`)
      }

      if (errors.length > 0) {
        toast.error('部分冲突处理失败', {
          description: errors[0],
        })
      }

      if (processed > 0 || errors.length > 0) {
        void conflictsQuery.refetch()
        void summaryQuery.refetch()
        void queryClient.invalidateQueries({ queryKey: PHOTO_ASSET_LIST_QUERY_KEY })
      }
    },
    [conflictsQuery, resolveConflictMutation, summaryQuery, queryClient],
  )

  const showConflictsPanel =
    conflictsQuery.isLoading ||
    conflictsQuery.isFetching ||
    (conflictsQuery.data?.length ?? 0) > 0 ||
    (result?.summary.conflicts ?? 0) > 0

  const controllerValue = useMemo(
    () => ({
      onCompleted: handleSyncCompleted,
      onProgress: handleProgressEvent,
      onError: handleSyncError,
    }),
    [handleSyncCompleted, handleProgressEvent, handleSyncError],
  )

  let conflictsPanel: ReactNode | null = null
  if (showConflictsPanel) {
    conflictsPanel = (
      <PhotoSyncConflictsPanel
        conflicts={conflictsQuery.data}
        isLoading={conflictsQuery.isLoading || conflictsQuery.isFetching}
        resolvingId={resolvingConflictId}
        isBatchResolving={resolvingConflictId === BATCH_RESOLVING_ID}
        onResolve={handleResolveConflict}
        onResolveBatch={handleResolveConflictsBatch}
        onRequestStorageUrl={getPhotoStorageUrl}
      />
    )
  }

  return (
    <PhotoSyncControllerProvider value={controllerValue}>
      <PhotoPageScaffold activeTab="sync">
        {syncProgress ? <PhotoSyncProgressPanel progress={syncProgress} /> : null}
        <div className="space-y-6">
          {conflictsPanel}
          <PhotoSyncResultPanel
            result={result}
            lastWasDryRun={lastWasDryRun}
            baselineSummary={summaryQuery.data}
            isSummaryLoading={summaryQuery.isLoading}
            lastSyncRun={syncStatus?.lastRun ?? null}
            isSyncStatusLoading={isSyncStatusLoading || isSyncStatusFetching}
            onRequestStorageUrl={getPhotoStorageUrl}
          />
        </div>
      </PhotoPageScaffold>
    </PhotoSyncControllerProvider>
  )
}
