import { Button } from '@afilmory/ui'
import { clsxm } from '@afilmory/utils'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { LinearBorderPanel } from '~/components/common/GlassPanel'
import { MainPageLayout } from '~/components/layouts/MainPageLayout'
import type { SessionResponse } from '~/modules/auth/api/session'
import { AUTH_SESSION_QUERY_KEY } from '~/modules/auth/api/session'
import { authClient } from '~/modules/auth/auth-client'
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
  const queryClient = useQueryClient()
  const session = (queryClient.getQueryData<SessionResponse | null>(AUTH_SESSION_QUERY_KEY) ??
    null) as SessionResponse | null

  const tenantId = session?.tenant?.id ?? null
  const tenantSlug = session?.tenant?.slug ?? null

  const plan = planQuery.data?.plan ?? null
  const availablePlans = planQuery.data?.availablePlans ?? []
  const plans = useMemo(() => {
    if (!plan) {
      return []
    }
    const merged = new Map<string, BillingPlanSummary>()
    for (const candidate of [plan, ...availablePlans]) {
      if (candidate && !merged.has(candidate.planId)) {
        merged.set(candidate.planId, candidate)
      }
    }
    return Array.from(merged.values())
  }, [availablePlans, plan])

  return (
    <MainPageLayout title="订阅计划" description="查看当前订阅状态与资源限制，并在此处发起升级或管理订阅。">
      <div className="space-y-6">
        {planQuery.isError && (
          <div className="text-red text-sm">
            无法加载订阅信息：{planQuery.error instanceof Error ? planQuery.error.message : '未知错误'}
          </div>
        )}

        {planQuery.isLoading || !plan ? (
          <PlanSkeleton />
        ) : (
          <PlanList currentPlanId={plan.planId} plans={plans} tenantId={tenantId} tenantSlug={tenantSlug} />
        )}
      </div>
    </MainPageLayout>
  )
}

function PlanList({
  currentPlanId,
  plans,
  tenantId,
  tenantSlug,
}: {
  currentPlanId: string
  plans: BillingPlanSummary[]
  tenantId: string | null
  tenantSlug: string | null
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {plans.map((plan) => (
        <PlanCard
          key={plan.planId}
          plan={plan}
          isCurrent={plan.planId === currentPlanId}
          tenantId={tenantId}
          tenantSlug={tenantSlug}
        />
      ))}
    </div>
  )
}

function PlanCard({
  plan,
  isCurrent,
  tenantId,
  tenantSlug,
}: {
  plan: BillingPlanSummary
  isCurrent: boolean
  tenantId: string | null
  tenantSlug: string | null
}) {
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const productId = plan.payment?.creemProductId ?? null

  const canCheckout = Boolean(!isCurrent && tenantId && productId)

  const showPortalButton = isCurrent && plan.planId !== 'free' && Boolean(productId)

  const handleCheckout = async () => {
    if (!canCheckout || !tenantId || !productId) {
      toast.error('该方案暂未开放，请稍后再试。')
      return
    }
    setCheckoutLoading(true)
    const successUrl = buildCheckoutSuccessUrl(tenantSlug)
    const metadata: Record<string, string> = {
      tenantId,
      planId: plan.planId,
    }
    if (tenantSlug) {
      metadata.tenantSlug = tenantSlug
    }
    try {
      const { data, error } = await authClient.creem.createCheckout({
        productId,
        successUrl,
        metadata,
      })
      if (error) {
        throw new Error(error.message ?? 'Creem 返回了未知错误')
      }
      if (data?.url) {
        window.location.href = data.url
        return
      }
      toast.error('Creem 未返回有效的结算链接，请稍后再试。')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '无法创建订阅结算会话')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const handlePortal = async () => {
    if (!showPortalButton) {
      return
    }
    setPortalLoading(true)
    try {
      const { data, error } = await authClient.creem.createPortal()
      if (error) {
        throw new Error(error.message ?? '无法打开订阅管理')
      }
      if (data?.url) {
        window.location.href = data.url
        return
      }
      toast.error('Creem 未返回订阅管理地址，请稍后再试。')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '无法打开订阅管理')
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <LinearBorderPanel className="bg-background-secondary/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text">{plan.name}</h2>
          <p className="text-text-secondary text-sm">{plan.description}</p>
          {plan.pricing && plan.pricing.monthlyPrice !== null && plan.pricing.monthlyPrice !== undefined && (
            <p
              className={clsxm(
                'text-text absolute right-0 top-0 mt-1 text-sm font-semibold',
                isCurrent && 'translate-y-6',
              )}
            >
              {formatPrice(plan.pricing.monthlyPrice, plan.pricing.currency)}
            </p>
          )}
        </div>
        {isCurrent && <CurrentBadge planId={plan.planId} />}
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
        <Button
          type="button"
          className="mt-4 w-full"
          size="sm"
          disabled={!canCheckout || checkoutLoading}
          onClick={handleCheckout}
        >
          {checkoutLoading ? '请稍候…' : canCheckout ? '升级此方案' : '敬请期待'}
        </Button>
      )}

      {showPortalButton && (
        <Button
          type="button"
          variant="secondary"
          className="mt-4 w-full"
          size="sm"
          disabled={portalLoading}
          onClick={handlePortal}
        >
          {portalLoading ? '打开中…' : '管理订阅'}
        </Button>
      )}
    </LinearBorderPanel>
  )
}

function buildCheckoutSuccessUrl(tenantSlug: string | null): string {
  const { origin, pathname, search, hash, protocol, hostname, port } = window.location
  const defaultUrl = `${origin}${pathname}${search}${hash}`
  const isLocalSubdomain = hostname !== 'localhost' && hostname.endsWith('.localhost')

  if (!isLocalSubdomain) {
    return defaultUrl
  }

  const redirectOrigin = `${protocol}//localhost${port ? `:${port}` : ''}`
  const redirectUrl = new URL('/creem-redirect.html', redirectOrigin)
  redirectUrl.searchParams.set('redirect', defaultUrl)
  if (tenantSlug) {
    redirectUrl.searchParams.set('tenant', tenantSlug)
  }
  return redirectUrl.toString()
}

function CurrentBadge({ planId }: { planId: string }) {
  const label = planId === 'friend' ? '内部方案' : '当前方案'
  return <span className="bg-accent/10 text-accent rounded-full px-2 py-0.5 text-xs font-semibold">{label}</span>
}

function renderQuotaValue(value: number | null, unit?: string): string {
  if (value === null || value === undefined) {
    return '无限制'
  }
  const numeral = value.toLocaleString('zh-CN')
  return unit ? `${numeral}${unit}` : numeral
}

function formatPrice(value: number, currency: string | null | undefined): string {
  const normalizedCurrency = currency?.toUpperCase() ?? ''
  const formatted = value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return normalizedCurrency ? `${normalizedCurrency} ${formatted}` : formatted
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
