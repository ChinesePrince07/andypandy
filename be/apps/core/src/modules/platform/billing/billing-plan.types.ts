export type BillingPlanId = 'free' | 'pro' | 'friend'

export interface BillingPlanQuota {
  monthlyAssetProcessLimit: number | null
  libraryItemLimit: number | null
  maxUploadSizeMb: number | null
  maxSyncObjectSizeMb: number | null
}

export interface BillingPlanDefinition {
  id: BillingPlanId
  name: string
  description: string
  quotas: BillingPlanQuota
}

export type BillingPlanQuotaOverride = Partial<BillingPlanQuota>

export type BillingPlanOverrides = Record<BillingPlanId | string, BillingPlanQuotaOverride>
