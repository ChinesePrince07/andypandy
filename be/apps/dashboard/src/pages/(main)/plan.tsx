import { Button } from '@afilmory/ui'
import { Spring } from '@afilmory/utils'
import { m } from 'motion/react'

import { MainPageLayout } from '~/components/layouts/MainPageLayout'
import type { BillingPlanSummary } from '~/modules/billing'
import { useTenantPlanQuery } from '~/modules/billing'

const QUOTA_LABELS: Record<string, string> = {
  monthlyAssetProcessLimit: '每月可新增照片',
  libraryItemLimit: '图库容量',
  maxUploadSizeMb: '单次上传大小',
  maxSyncObjectSizeMb: '同步素材大小',
}

const QUOTA_UNITS: Record<string, string> = {
  monthlyAssetProcessLimit: '张',
  libraryItemLimit: '张',
  maxUploadSizeMb: ' MB',
  maxSyncObjectSizeMb: ' MB',
}

export function Component() {
  const planQuery = useTenantPlanQuery()

  const plan = planQuery.data?.plan ?? null
  const availablePlans = planQuery.data?.availablePlans ?? []

  return (
    <MainPageLayout title="订阅计划" description="查看当前订阅状态与资源限制，未来版本将在此处开放升级入口。">
      <div className="space-y-6">
        {planQuery.isError && (
          <div className="text-red text-sm">
            无法加载订阅信息：{planQuery.error instanceof Error ? planQuery.error.message : '未知错误'}
          </div>
        )}

        {planQuery.isLoading || !plan ? (
          <PlanSkeleton />
        ) : (
          <PlanList currentPlanId={plan.planId} plans={availablePlans.length > 0 ? availablePlans : [plan]} />
        )}
      </div>
    </MainPageLayout>
  )
}

function PlanList({ currentPlanId, plans }: { currentPlanId: string; plans: BillingPlanSummary[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {plans.map((plan) => (
        <PlanCard key={plan.planId} plan={plan} isCurrent={plan.planId === currentPlanId} />
      ))}
    </div>
  )
}

function PlanCard({ plan, isCurrent }: { plan: BillingPlanSummary; isCurrent: boolean }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={Spring.presets.smooth}
      className="rounded-2xl border border-border/40 bg-background-secondary/70 p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text">{plan.name}</h2>
          <p className="text-text-secondary text-sm">{plan.description}</p>
        </div>
        {isCurrent && <CurrentBadge />}
      </div>

      <ul className="mt-6 space-y-2">
        {Object.entries(plan.quotas).map(([key, value]) => (
          <li key={key} className="flex items-center justify-between text-sm">
            <span className="text-text-tertiary">{QUOTA_LABELS[key] ?? key}</span>
            <span className="text-text font-medium">{renderQuotaValue(value, QUOTA_UNITS[key])}</span>
          </li>
        ))}
      </ul>

      {!isCurrent && (
        <Button type="button" disabled className="mt-4 w-full" size="sm">
          即将开放
        </Button>
      )}
    </m.div>
  )
}

function CurrentBadge() {
  return <span className="bg-accent/10 text-accent rounded-full px-2 py-0.5 text-xs font-semibold">当前方案</span>
}

function renderQuotaValue(value: number | null, unit?: string): string {
  if (value === null || value === undefined) {
    return '无限制'
  }
  const numeral = value.toLocaleString('zh-CN')
  return unit ? `${numeral}${unit}` : numeral
}

function PlanSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={`plan-skeleton-${index}`}
          className="rounded-2xl border border-border/30 bg-background-secondary/40 p-5"
        >
          <div className="bg-fill/50 h-6 w-1/2 animate-pulse rounded" />
          <div className="bg-fill/30 mt-2 h-4 w-2/3 animate-pulse rounded" />
          <div className="mt-6 space-y-2">
            {Array.from({ length: 4 }).map((__, quotaIndex) => (
              <div key={`quota-${quotaIndex}`} className="bg-fill/20 h-4 animate-pulse rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
