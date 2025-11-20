import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@afilmory/ui'
import { Spring } from '@afilmory/utils'
import { RefreshCcwIcon } from 'lucide-react'
import { m } from 'motion/react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { LinearBorderPanel } from '~/components/common/LinearBorderPanel'
import { BILLING_USAGE_EVENT_CONFIG } from '~/modules/photos/constants'
import type { BillingUsageEventType } from '~/modules/photos/types'

import { useSuperAdminTenantsQuery, useUpdateTenantBanMutation, useUpdateTenantPlanMutation } from '../hooks'
import type { BillingPlanDefinition, SuperAdminTenantSummary } from '../types'

const DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function SuperAdminTenantManager() {
  const tenantsQuery = useSuperAdminTenantsQuery()
  const updatePlanMutation = useUpdateTenantPlanMutation()
  const updateBanMutation = useUpdateTenantBanMutation()
  const { t } = useTranslation()

  const { isLoading } = tenantsQuery
  const { isError } = tenantsQuery
  const { data } = tenantsQuery

  const plans = data?.plans ?? []
  const tenants = data?.tenants ?? []

  const handlePlanChange = (tenant: SuperAdminTenantSummary, planId: string) => {
    if (planId === tenant.planId) {
      return
    }
    updatePlanMutation.mutate(
      { tenantId: tenant.id, planId },
      {
        onSuccess: () => {
          toast.success(t('superadmin.tenants.toast.plan-success', { name: tenant.name, planId }))
        },
        onError: (error) => {
          toast.error(t('superadmin.tenants.toast.plan-error'), {
            description: error instanceof Error ? error.message : t('common.retry-later'),
          })
        },
      },
    )
  }

  const handleToggleBanned = (tenant: SuperAdminTenantSummary) => {
    const next = !tenant.banned
    updateBanMutation.mutate(
      { tenantId: tenant.id, banned: next },
      {
        onSuccess: () => {
          toast.success(
            next
              ? t('superadmin.tenants.toast.ban-success', { name: tenant.name })
              : t('superadmin.tenants.toast.unban-success', { name: tenant.name }),
          )
        },
        onError: (error) => {
          toast.error(t('superadmin.tenants.toast.ban-error'), {
            description: error instanceof Error ? error.message : t('common.retry-later'),
          })
        },
      },
    )
  }

  const isPlanUpdating = (tenantId: string) =>
    updatePlanMutation.isPending && updatePlanMutation.variables?.tenantId === tenantId

  const isBanUpdating = (tenantId: string) =>
    updateBanMutation.isPending && updateBanMutation.variables?.tenantId === tenantId

  if (isError) {
    return (
      <LinearBorderPanel className="p-6 text-sm text-red">
        {t('superadmin.tenants.error.loading', {
          reason: tenantsQuery.error instanceof Error ? tenantsQuery.error.message : t('common.unknown-error'),
        })}
      </LinearBorderPanel>
    )
  }

  if (isLoading) {
    return <TenantSkeleton />
  }

  return (
    <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={Spring.presets.smooth}>
      <LinearBorderPanel className="p-6 bg-background-secondary">
        <header className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => tenantsQuery.refetch()}
            disabled={tenantsQuery.isFetching}
          >
            <RefreshCcwIcon className="size-4" />
            <span>
              {tenantsQuery.isFetching
                ? t('superadmin.tenants.refresh.loading')
                : t('superadmin.tenants.refresh.button')}
            </span>
          </Button>
        </header>

        {tenants.length === 0 ? (
          <p className="text-text-secondary text-sm">{t('superadmin.tenants.empty')}</p>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full divide-y divide-border/40 text-sm">
              <thead>
                <tr className="text-text-tertiary text-xs uppercase tracking-wide">
                  <th className="px-3 py-2 text-left">{t('superadmin.tenants.table.tenant')}</th>
                  <th className="px-3 py-2 text-left">{t('superadmin.tenants.table.plan')}</th>
                  <th className="px-3 py-2 text-left">{t('superadmin.tenants.table.usage')}</th>
                  <th className="px-3 py-2 text-center">{t('superadmin.tenants.table.status')}</th>
                  <th className="px-3 py-2 text-center">{t('superadmin.tenants.table.ban')}</th>
                  <th className="px-3 py-2 text-left">{t('superadmin.tenants.table.created')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td className="px-3 py-3">
                      <div className="font-medium text-text">{tenant.name}</div>
                      <div className="text-text-secondary text-xs">{tenant.slug}</div>
                    </td>
                    <td className="px-3 py-3">
                      <PlanSelector
                        value={tenant.planId}
                        plans={plans}
                        disabled={isPlanUpdating(tenant.id)}
                        onChange={(nextPlan) => handlePlanChange(tenant, nextPlan)}
                      />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <TenantUsageCell usageTotals={tenant.usageTotals} />
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <StatusBadge status={tenant.status} banned={tenant.banned} />
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={tenant.banned ? 'text-rose-400' : undefined}
                        onClick={() => handleToggleBanned(tenant)}
                        disabled={isBanUpdating(tenant.id)}
                      >
                        {isBanUpdating(tenant.id)
                          ? t('superadmin.tenants.button.processing')
                          : tenant.banned
                            ? t('superadmin.tenants.button.unban')
                            : t('superadmin.tenants.button.ban')}
                      </Button>
                    </td>
                    <td className="px-3 py-3 text-text-secondary text-xs">{formatDateLabel(tenant.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </LinearBorderPanel>
    </m.div>
  )
}

function PlanSelector({
  value,
  plans,
  disabled,
  onChange,
}: {
  value: string
  plans: BillingPlanDefinition[]
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1">
      <Select value={value} onValueChange={(value) => onChange(value)} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={t('superadmin.tenants.plan.placeholder')} />
        </SelectTrigger>
        <SelectContent>
          {plans.map((plan) => (
            <SelectItem value={plan.id} key={plan.id}>
              {plan.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <PlanDescription plan={plans.find((plan) => plan.id === value)} />
    </div>
  )
}

function TenantUsageCell({ usageTotals }: { usageTotals: SuperAdminTenantSummary['usageTotals'] }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language ?? i18n.resolvedLanguage ?? 'en'
  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
    [locale],
  )

  const entries = useMemo(() => {
    const totalsMap = new Map<BillingUsageEventType, { total: number; unit: 'count' | 'byte' }>()
    usageTotals?.forEach((entry) => {
      totalsMap.set(entry.eventType as BillingUsageEventType, {
        total: entry.totalQuantity ?? 0,
        unit: entry.unit,
      })
    })

    return (Object.keys(BILLING_USAGE_EVENT_CONFIG) as BillingUsageEventType[]).map((eventType) => {
      const config = BILLING_USAGE_EVENT_CONFIG[eventType]
      const usage = totalsMap.get(eventType)
      return {
        eventType,
        label: t(config.labelKey),
        tone: config.tone,
        total: usage?.total ?? 0,
        unit: usage?.unit ?? 'count',
      }
    })
  }, [usageTotals, t])

  const activeEntries = entries.filter((entry) => entry.total > 0)

  if (activeEntries.length === 0) {
    return <p className="text-text-tertiary text-xs">{t('superadmin.tenants.usage.empty')}</p>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {activeEntries.map((entry) => (
        <UsageBadge
          key={`${entry.eventType}`}
          label={entry.label}
          tone={entry.tone}
          value={entry.total}
          unit={entry.unit}
          formatter={numberFormatter}
        />
      ))}
    </div>
  )
}

function PlanDescription({ plan }: { plan: BillingPlanDefinition | undefined }) {
  if (!plan) {
    return null
  }
  return <p className="text-text-tertiary text-xs">{plan.description}</p>
}

type UsageBadgeProps = {
  label: string
  tone: (typeof BILLING_USAGE_EVENT_CONFIG)[BillingUsageEventType]['tone']
  value: number
  unit: 'count' | 'byte'
  formatter: Intl.NumberFormat
}

function UsageBadge({ label, tone, value, unit, formatter }: UsageBadgeProps) {
  const toneClass =
    tone === 'accent'
      ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30'
      : tone === 'warning'
        ? 'bg-rose-500/10 text-rose-200 border-rose-500/30'
        : 'bg-fill/30 text-text-secondary border-border/40'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClass}`}
    >
      <span className="uppercase tracking-wide text-[10px] text-text-tertiary/80">{label}</span>
      <span className="text-xs font-semibold text-text">{formatUsageValue(value, unit, formatter)}</span>
    </span>
  )
}

function formatUsageValue(value: number, unit: 'count' | 'byte', formatter: Intl.NumberFormat): string {
  if (!Number.isFinite(value)) {
    return '0'
  }
  if (unit === 'byte') {
    return formatBytes(value)
  }
  return formatter.format(value)
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

function StatusBadge({ status, banned }: { status: SuperAdminTenantSummary['status']; banned: boolean }) {
  const { t } = useTranslation()
  if (banned) {
    return (
      <span className="bg-rose-500/10 text-rose-400 rounded-full px-2 py-0.5 text-xs">
        {t('superadmin.tenants.status.banned')}
      </span>
    )
  }
  if (status === 'active') {
    return (
      <span className="bg-emerald-500/10 text-emerald-400 rounded-full px-2 py-0.5 text-xs">
        {t('superadmin.tenants.status.active')}
      </span>
    )
  }
  if (status === 'suspended') {
    return (
      <span className="bg-amber-500/10 text-amber-400 rounded-full px-2 py-0.5 text-xs">
        {t('superadmin.tenants.status.suspended')}
      </span>
    )
  }
  return (
    <span className="bg-slate-500/10 text-slate-400 rounded-full px-2 py-0.5 text-xs">
      {t('superadmin.tenants.status.inactive')}
    </span>
  )
}

function formatDateLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return DATE_FORMATTER.format(date)
}

function TenantSkeleton() {
  return (
    <LinearBorderPanel className="space-y-4 p-6">
      <div className="bg-fill/40 h-6 w-1/3 animate-pulse rounded" />
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={`tenant-skeleton-${index}`} className="bg-fill/20 h-14 animate-pulse rounded" />
        ))}
      </div>
    </LinearBorderPanel>
  )
}
