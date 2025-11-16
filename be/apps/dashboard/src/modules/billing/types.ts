export interface BillingPlanQuota {
  monthlyAssetProcessLimit: number | null
  libraryItemLimit: number | null
  maxUploadSizeMb: number | null
  maxSyncObjectSizeMb: number | null
}

export interface BillingPlanSummary {
  planId: string
  name: string
  description: string
  quotas: BillingPlanQuota
}

export interface BillingPlanResponse {
  plan: BillingPlanSummary
  availablePlans: BillingPlanSummary[]
}
