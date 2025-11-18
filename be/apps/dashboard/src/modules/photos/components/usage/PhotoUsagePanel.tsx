import { Button } from '@afilmory/ui'
import { useMemo } from 'react'

import { LinearBorderPanel } from '~/components/common/GlassPanel'

import { BILLING_USAGE_EVENT_CONFIG, getUsageEventDescription, getUsageEventLabel } from '../../constants'
import type { BillingUsageEvent, BillingUsageOverview } from '../../types'

type PhotoUsagePanelProps = {
  overview?: BillingUsageOverview | null
  isLoading?: boolean
  isFetching?: boolean
  onRefresh?: () => void
}

const NUMBER_FORMATTER = new Intl.NumberFormat('zh-CN')
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
})
const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' })

export function PhotoUsagePanel({ overview, isLoading, isFetching, onRefresh }: PhotoUsagePanelProps) {
  const summaryItems = useMemo(() => {
    const totals = overview?.totals ?? []
    const totalMap = new Map(totals.map((entry) => [entry.eventType, entry.totalQuantity]))
    return (
      Object.entries(BILLING_USAGE_EVENT_CONFIG) as [
        BillingUsageEvent['eventType'],
        (typeof BILLING_USAGE_EVENT_CONFIG)[BillingUsageEvent['eventType']],
      ][]
    ).map(([eventType, config]) => ({
      eventType,
      label: getUsageEventLabel(eventType),
      description: getUsageEventDescription(eventType),
      tone: config.tone,
      value: totalMap.get(eventType) ?? 0,
    }))
  }, [overview?.totals])

  const events = overview?.events ?? []
  const isEmpty = !isLoading && events.length === 0

  return (
    <div className="space-y-6">
      <LinearBorderPanel className="bg-background-secondary/60 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-text">用量概览</h3>
            <p className="text-sm text-text-secondary">按事件类型统计的累计用量。</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={onRefresh}
            disabled={isFetching || isLoading}
          >
            <i className={`i-lucide-rotate-cw size-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden />
            刷新
          </Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {isLoading && events.length === 0
            ? Array.from({ length: 3 }).map((_, index) => <SummarySkeleton key={`usage-summary-skeleton-${index}`} />)
            : summaryItems.map((item) => (
                <SummaryCard
                  key={item.eventType}
                  label={item.label}
                  description={item.description}
                  value={item.value}
                  tone={item.tone}
                />
              ))}
        </div>
      </LinearBorderPanel>

      <LinearBorderPanel className="bg-background-secondary/60">
        <div className="flex flex-col gap-2 border-b border-border/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-text">最近用量事件</h3>
            <p className="text-sm text-text-secondary">展示最新的计费用量明细，包含上传、删除和同步操作。</p>
          </div>
          {events.length > 0 && <p className="text-xs text-text-tertiary">共 {events.length} 条记录</p>}
        </div>

        {isLoading ? (
          <div className="divide-y divide-border/20">
            {Array.from({ length: 4 }).map((_, index) => (
              <UsageEventSkeleton key={`usage-event-skeleton-${index}`} />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="px-5 py-12 text-center">
            <p className="text-lg font-medium text-text">暂无用量记录</p>
            <p className="mt-2 text-sm text-text-secondary">成功上传照片或运行同步后，将在此展示计费相关事件。</p>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {events.map((event) => (
              <UsageEventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </LinearBorderPanel>
    </div>
  )
}

type SummaryCardProps = {
  label: string
  description: string
  value: number
  tone: 'accent' | 'warning' | 'muted'
}

function SummaryCard({ label, description, value, tone }: SummaryCardProps) {
  const toneClass = tone === 'accent' ? 'text-emerald-400' : tone === 'warning' ? 'text-rose-400' : 'text-text'

  return (
    <LinearBorderPanel className="bg-background-tertiary/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{NUMBER_FORMATTER.format(value)}</p>
      <p className="mt-1 text-xs text-text-secondary">{description}</p>
    </LinearBorderPanel>
  )
}

function SummarySkeleton() {
  return (
    <div className="rounded-xl bg-background-tertiary/60 p-4">
      <div className="h-3 w-1/3 animate-pulse rounded-full bg-border/60" />
      <div className="mt-4 h-8 w-2/5 animate-pulse rounded bg-border/60" />
      <div className="mt-3 h-3 w-3/5 animate-pulse rounded-full bg-border/40" />
    </div>
  )
}

type UsageEventRowProps = {
  event: BillingUsageEvent
}

function UsageEventRow({ event }: UsageEventRowProps) {
  const label = getUsageEventLabel(event.eventType)
  const description = getUsageEventDescription(event.eventType)
  const quantityClass = event.quantity >= 0 ? 'text-emerald-400' : 'text-rose-400'
  const dateLabel = formatDateLabel(event.occurredAt)
  const relativeLabel = formatRelativeLabel(event.occurredAt)

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex-1">
        <p className="text-sm font-semibold text-text">{label}</p>
        {description && <p className="text-xs text-text-secondary">{description}</p>}
        <MetadataBadges metadata={event.metadata} />
      </div>
      <div className="flex flex-col items-start gap-1 text-right text-sm sm:min-w-[160px]">
        <p className={`text-base font-semibold ${quantityClass}`}>{NUMBER_FORMATTER.format(event.quantity)}</p>
        <p className="text-xs text-text-secondary">单位：{event.unit === 'byte' ? '字节' : '次数'}</p>
      </div>
      <div className="text-right text-sm text-text-secondary sm:min-w-[180px]">
        <p>{dateLabel}</p>
        {relativeLabel && <p className="text-xs text-text-tertiary">{relativeLabel}</p>}
      </div>
    </div>
  )
}

function MetadataBadges({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata) {
    return <p className="mt-3 text-xs text-text-tertiary">—</p>
  }

  const entries = Object.entries(metadata).filter(([, value]) => value != null)
  if (entries.length === 0) {
    return <p className="mt-3 text-xs text-text-tertiary">—</p>
  }

  const visibleEntries = entries.slice(0, 4)
  const remaining = entries.length - visibleEntries.length

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {visibleEntries.map(([key, value]) => (
        <span
          key={key}
          className="rounded-full border border-border/50 bg-background/60 px-2 py-0.5 text-xs text-text-secondary"
        >
          {key}: {formatMetadataValue(value)}
        </span>
      ))}
      {remaining > 0 && <span className="text-xs text-text-tertiary">+{remaining} 更多</span>}
    </div>
  )
}

function UsageEventSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 animate-pulse rounded bg-border/50" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-border/40" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-border/30" />
      </div>
      <div className="h-6 w-24 animate-pulse rounded bg-border/40" />
      <div className="h-4 w-32 animate-pulse rounded bg-border/30" />
    </div>
  )
}

function formatMetadataValue(value: unknown): string {
  if (value == null) {
    return '无'
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function formatDateLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return DATE_TIME_FORMATTER.format(date)
}

function formatRelativeLabel(value: string): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  const diffMs = date.getTime() - Date.now()
  const diffMinutes = Math.round(diffMs / (1000 * 60))
  if (Math.abs(diffMinutes) < 60) {
    return RELATIVE_FORMATTER.format(diffMinutes, 'minute')
  }
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) {
    return RELATIVE_FORMATTER.format(diffHours, 'hour')
  }
  const diffDays = Math.round(diffHours / 24)
  return RELATIVE_FORMATTER.format(diffDays, 'day')
}
