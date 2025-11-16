import { authUsers } from '@afilmory/db'
import { DbAccessor } from 'core/database/database.provider'
import { BizException, ErrorCode } from 'core/errors'
import type { SocialProvidersConfig } from 'core/modules/platform/auth/auth.config'
import {
  BILLING_PLAN_OVERRIDES_SETTING_KEY,
  BILLING_PLAN_PRICING_SETTING_KEY,
  BILLING_PLAN_PRODUCTS_SETTING_KEY,
} from 'core/modules/platform/billing/billing-plan.constants'
import type {
  BillingPlanId,
  BillingPlanOverrides,
  BillingPlanPaymentInfo,
  BillingPlanPricing,
  BillingPlanPricingConfigs,
  BillingPlanProductConfigs,
  BillingPlanQuota,
} from 'core/modules/platform/billing/billing-plan.types'
import { sql } from 'drizzle-orm'
import { injectable } from 'tsyringe'
import type { ZodType } from 'zod'
import { z } from 'zod'

import type { SystemSettingDbField } from './system-setting.constants'
import {
  BILLING_PLAN_FIELD_DESCRIPTORS,
  SYSTEM_SETTING_DEFINITIONS,
  SYSTEM_SETTING_KEYS,
} from './system-setting.constants'
import { SystemSettingStore } from './system-setting.store.service'
import type {
  SystemSettingOverview,
  SystemSettings,
  SystemSettingStats,
  SystemSettingValueMap,
  UpdateSystemSettingsInput,
} from './system-setting.types'
import { SYSTEM_SETTING_UI_SCHEMA } from './system-setting.ui-schema'

@injectable()
export class SystemSettingService {
  constructor(
    private readonly systemSettingStore: SystemSettingStore,
    private readonly dbAccessor: DbAccessor,
  ) {}

  async getSettings(): Promise<SystemSettings> {
    const rawValues = await this.systemSettingStore.getMany(SYSTEM_SETTING_KEYS)

    const allowRegistration = this.parseSetting(
      rawValues[SYSTEM_SETTING_DEFINITIONS.allowRegistration.key],
      SYSTEM_SETTING_DEFINITIONS.allowRegistration.schema,
      SYSTEM_SETTING_DEFINITIONS.allowRegistration.defaultValue,
    )

    const maxRegistrableUsers = this.parseSetting(
      rawValues[SYSTEM_SETTING_DEFINITIONS.maxRegistrableUsers.key],
      SYSTEM_SETTING_DEFINITIONS.maxRegistrableUsers.schema,
      SYSTEM_SETTING_DEFINITIONS.maxRegistrableUsers.defaultValue,
    )

    const localProviderEnabled = this.parseSetting(
      rawValues[SYSTEM_SETTING_DEFINITIONS.localProviderEnabled.key],
      SYSTEM_SETTING_DEFINITIONS.localProviderEnabled.schema,
      SYSTEM_SETTING_DEFINITIONS.localProviderEnabled.defaultValue,
    )

    const baseDomainRaw = this.parseSetting(
      rawValues[SYSTEM_SETTING_DEFINITIONS.baseDomain.key],
      SYSTEM_SETTING_DEFINITIONS.baseDomain.schema,
      SYSTEM_SETTING_DEFINITIONS.baseDomain.defaultValue,
    )

    const baseDomain = baseDomainRaw.trim().toLowerCase()

    const oauthGatewayUrl = this.normalizeGatewayUrl(
      this.parseSetting(
        rawValues[SYSTEM_SETTING_DEFINITIONS.oauthGatewayUrl.key],
        SYSTEM_SETTING_DEFINITIONS.oauthGatewayUrl.schema,
        SYSTEM_SETTING_DEFINITIONS.oauthGatewayUrl.defaultValue,
      ),
    )

    const oauthGoogleClientId = this.parseSetting(
      rawValues[SYSTEM_SETTING_DEFINITIONS.oauthGoogleClientId.key],
      SYSTEM_SETTING_DEFINITIONS.oauthGoogleClientId.schema,
      SYSTEM_SETTING_DEFINITIONS.oauthGoogleClientId.defaultValue,
    )
    const oauthGoogleClientSecret = this.parseSetting(
      rawValues[SYSTEM_SETTING_DEFINITIONS.oauthGoogleClientSecret.key],
      SYSTEM_SETTING_DEFINITIONS.oauthGoogleClientSecret.schema,
      SYSTEM_SETTING_DEFINITIONS.oauthGoogleClientSecret.defaultValue,
    )
    const oauthGithubClientId = this.parseSetting(
      rawValues[SYSTEM_SETTING_DEFINITIONS.oauthGithubClientId.key],
      SYSTEM_SETTING_DEFINITIONS.oauthGithubClientId.schema,
      SYSTEM_SETTING_DEFINITIONS.oauthGithubClientId.defaultValue,
    )
    const oauthGithubClientSecret = this.parseSetting(
      rawValues[SYSTEM_SETTING_DEFINITIONS.oauthGithubClientSecret.key],
      SYSTEM_SETTING_DEFINITIONS.oauthGithubClientSecret.schema,
      SYSTEM_SETTING_DEFINITIONS.oauthGithubClientSecret.defaultValue,
    )
    const billingPlanOverrides = this.parseSetting(
      rawValues[SYSTEM_SETTING_DEFINITIONS.billingPlanOverrides.key],
      BILLING_PLAN_OVERRIDES_SCHEMA,
      {},
    ) as BillingPlanOverrides
    const billingPlanProducts = this.parseSetting(
      rawValues[SYSTEM_SETTING_DEFINITIONS.billingPlanProducts.key],
      BILLING_PLAN_PRODUCTS_SCHEMA,
      {},
    ) as BillingPlanProductConfigs
    const billingPlanPricing = this.parseSetting(
      rawValues[SYSTEM_SETTING_DEFINITIONS.billingPlanPricing.key],
      BILLING_PLAN_PRICING_SCHEMA,
      {},
    ) as BillingPlanPricingConfigs
    return {
      allowRegistration,
      maxRegistrableUsers,
      localProviderEnabled,
      baseDomain,
      oauthGatewayUrl,
      oauthGoogleClientId,
      oauthGoogleClientSecret,
      oauthGithubClientId,
      oauthGithubClientSecret,
      billingPlanOverrides,
      billingPlanProducts,
      billingPlanPricing,
    }
  }

  async getBillingPlanOverrides(): Promise<BillingPlanOverrides> {
    const settings = await this.getSettings()
    return settings.billingPlanOverrides ?? {}
  }

  async getBillingPlanProducts(): Promise<BillingPlanProductConfigs> {
    const settings = await this.getSettings()
    return settings.billingPlanProducts ?? {}
  }

  async getBillingPlanPricing(): Promise<BillingPlanPricingConfigs> {
    const settings = await this.getSettings()
    return settings.billingPlanPricing ?? {}
  }

  async getOverview(): Promise<SystemSettingOverview> {
    const settings = await this.getSettings()
    const totalUsers = await this.getTotalUserCount()
    const stats = this.buildStats(settings, totalUsers)
    return {
      schema: SYSTEM_SETTING_UI_SCHEMA,
      values: this.buildValueMap(settings),
      stats,
    }
  }

  async updateSettings(patch: UpdateSystemSettingsInput): Promise<SystemSettings> {
    if (!patch || Object.values(patch).every((value) => value === undefined)) {
      return await this.getSettings()
    }

    const current = await this.getSettings()
    const planFieldUpdates = this.extractPlanFieldUpdates(patch)
    if (planFieldUpdates.hasUpdates) {
      await this.applyPlanFieldUpdates(current, planFieldUpdates)
    }

    const updates: Array<{ field: SystemSettingDbField; value: unknown }> = []

    const enqueueUpdate = <K extends SystemSettingDbField>(field: K, value: unknown) => {
      updates.push({ field, value })
      ;(current as unknown as Record<string, unknown>)[field] = value
    }

    if (patch.allowRegistration !== undefined && patch.allowRegistration !== current.allowRegistration) {
      enqueueUpdate('allowRegistration', patch.allowRegistration)
    }

    if (patch.localProviderEnabled !== undefined && patch.localProviderEnabled !== current.localProviderEnabled) {
      enqueueUpdate('localProviderEnabled', patch.localProviderEnabled)
    }

    if (patch.maxRegistrableUsers !== undefined) {
      const normalized = patch.maxRegistrableUsers === null ? null : Math.max(0, Math.trunc(patch.maxRegistrableUsers))
      if (normalized !== current.maxRegistrableUsers) {
        if (normalized !== null) {
          const totalUsers = await this.getTotalUserCount()
          if (normalized < totalUsers) {
            throw new BizException(ErrorCode.COMMON_BAD_REQUEST, {
              message: '最大可注册用户数不能小于当前用户总数',
            })
          }
        }

        enqueueUpdate('maxRegistrableUsers', normalized)
      }
    }

    if (patch.baseDomain !== undefined) {
      const sanitized = patch.baseDomain === null ? null : String(patch.baseDomain).trim().toLowerCase()
      if (!sanitized) {
        enqueueUpdate('baseDomain', SYSTEM_SETTING_DEFINITIONS.baseDomain.defaultValue)
      } else if (sanitized !== current.baseDomain) {
        enqueueUpdate('baseDomain', sanitized)
      }
    }
    if (patch.oauthGatewayUrl !== undefined) {
      const sanitized = this.normalizeGatewayUrl(patch.oauthGatewayUrl)
      if (sanitized !== current.oauthGatewayUrl) {
        enqueueUpdate('oauthGatewayUrl', sanitized)
      }
    }

    if (patch.oauthGoogleClientId !== undefined) {
      const sanitized = this.normalizeNullableString(patch.oauthGoogleClientId)
      if (sanitized !== current.oauthGoogleClientId) {
        enqueueUpdate('oauthGoogleClientId', sanitized)
      }
    }

    if (patch.oauthGoogleClientSecret !== undefined) {
      const sanitized = this.normalizeNullableString(patch.oauthGoogleClientSecret)
      if (sanitized !== current.oauthGoogleClientSecret) {
        enqueueUpdate('oauthGoogleClientSecret', sanitized)
      }
    }

    if (patch.oauthGithubClientId !== undefined) {
      const sanitized = this.normalizeNullableString(patch.oauthGithubClientId)
      if (sanitized !== current.oauthGithubClientId) {
        enqueueUpdate('oauthGithubClientId', sanitized)
      }
    }

    if (patch.oauthGithubClientSecret !== undefined) {
      const sanitized = this.normalizeNullableString(patch.oauthGithubClientSecret)
      if (sanitized !== current.oauthGithubClientSecret) {
        enqueueUpdate('oauthGithubClientSecret', sanitized)
      }
    }

    if (updates.length === 0) {
      return current
    }

    await this.systemSettingStore.setMany(
      updates.map((entry) => {
        const definition = SYSTEM_SETTING_DEFINITIONS[entry.field]
        return {
          key: definition.key,
          value: (entry.value ?? null) as unknown,
          options: { isSensitive: definition.isSensitive ?? false },
        }
      }),
    )

    return current
  }

  private buildValueMap(settings: SystemSettings): SystemSettingValueMap {
    const map = {} as SystemSettingValueMap

    ;(Object.keys(SYSTEM_SETTING_DEFINITIONS) as SystemSettingDbField[]).forEach((field) => {
      ;(map as Record<string, unknown>)[field] = settings[field]
    })

    const overrides = settings.billingPlanOverrides ?? {}
    BILLING_PLAN_FIELD_DESCRIPTORS.quotas.forEach((descriptor) => {
      const planOverrides = overrides[descriptor.planId]
      if (planOverrides && descriptor.key in (planOverrides as object)) {
        ;(map as Record<string, unknown>)[descriptor.field] =
          (planOverrides as BillingPlanQuota)[descriptor.key as keyof BillingPlanQuota] ?? null
      } else {
        ;(map as Record<string, unknown>)[descriptor.field] = descriptor.defaultValue ?? null
      }
    })

    const pricing = settings.billingPlanPricing ?? {}
    BILLING_PLAN_FIELD_DESCRIPTORS.pricing.forEach((descriptor) => {
      const entry = pricing[descriptor.planId]
      if (descriptor.key === 'currency') {
        ;(map as Record<string, unknown>)[descriptor.field] = entry?.currency ?? null
      } else if (descriptor.key === 'monthlyPrice') {
        ;(map as Record<string, unknown>)[descriptor.field] = entry?.monthlyPrice ?? null
      }
    })

    const products = settings.billingPlanProducts ?? {}
    BILLING_PLAN_FIELD_DESCRIPTORS.payment.forEach((descriptor) => {
      const entry = products[descriptor.planId]
      ;(map as Record<string, unknown>)[descriptor.field] = entry?.creemProductId ?? null
    })

    return map
  }

  private extractPlanFieldUpdates(patch: UpdateSystemSettingsInput): PlanFieldUpdateSummary {
    const summary: PlanFieldUpdateSummary = {
      hasUpdates: false,
      quotas: {},
      pricing: {},
      products: {},
    }

    for (const descriptor of BILLING_PLAN_FIELD_DESCRIPTORS.quotas) {
      if (!(descriptor.field in patch)) {
        continue
      }
      summary.hasUpdates = true
      const raw = patch[descriptor.field]
      delete (patch as Record<string, unknown>)[descriptor.field]
      const numericValue = raw === null || raw === undefined ? null : typeof raw === 'number' ? raw : Number(raw)

      const planPatch = summary.quotas[descriptor.planId] ?? {}
      planPatch[descriptor.key as keyof BillingPlanQuota] =
        numericValue === null || Number.isNaN(numericValue) ? null : numericValue
      summary.quotas[descriptor.planId] = planPatch
    }

    for (const descriptor of BILLING_PLAN_FIELD_DESCRIPTORS.pricing) {
      if (!(descriptor.field in patch)) {
        continue
      }
      summary.hasUpdates = true
      const raw = patch[descriptor.field]
      delete (patch as Record<string, unknown>)[descriptor.field]
      const planPatch = summary.pricing[descriptor.planId] ?? {}

      if (descriptor.key === 'currency') {
        const normalized =
          raw === null || raw === undefined
            ? null
            : typeof raw === 'string'
              ? this.normalizeNullableString(raw)
              : this.normalizeNullableString(String(raw))
        planPatch.currency = normalized
      } else if (descriptor.key === 'monthlyPrice') {
        const numericValue = raw === null || raw === undefined ? null : typeof raw === 'number' ? raw : Number(raw)
        planPatch.monthlyPrice = numericValue === null || Number.isNaN(numericValue) ? null : numericValue
      }

      summary.pricing[descriptor.planId] = planPatch
    }

    for (const descriptor of BILLING_PLAN_FIELD_DESCRIPTORS.payment) {
      if (!(descriptor.field in patch)) {
        continue
      }
      summary.hasUpdates = true
      const raw = patch[descriptor.field]
      delete (patch as Record<string, unknown>)[descriptor.field]
      const normalized =
        raw === null || raw === undefined
          ? null
          : typeof raw === 'string'
            ? this.normalizeNullableString(raw)
            : this.normalizeNullableString(String(raw))
      summary.products[descriptor.planId] = { creemProductId: normalized }
    }

    return summary
  }

  private async applyPlanFieldUpdates(current: SystemSettings, updates: PlanFieldUpdateSummary): Promise<void> {
    if (!updates.hasUpdates) {
      return
    }

    if (Object.keys(updates.quotas).length > 0) {
      const nextOverrides: BillingPlanOverrides = structuredClone(current.billingPlanOverrides ?? {})
      for (const [planId, quotaPatch] of Object.entries(updates.quotas) as Array<[
        BillingPlanId,
        Partial<BillingPlanQuota>,
      ]>) {
        const existing = { ...nextOverrides[planId] }
        for (const [quotaKey, value] of Object.entries(quotaPatch) as Array<[keyof BillingPlanQuota, number | null]>) {
          if (value === null || value === undefined || Number.isNaN(value)) {
            delete existing[quotaKey]
          } else {
            existing[quotaKey] = value
          }
        }
        if (Object.keys(existing).length === 0) {
          delete nextOverrides[planId]
        } else {
          nextOverrides[planId] = existing
        }
      }
      await this.systemSettingStore.set(BILLING_PLAN_OVERRIDES_SETTING_KEY, nextOverrides)
      current.billingPlanOverrides = nextOverrides
    }

    if (Object.keys(updates.pricing).length > 0) {
      const nextPricing: BillingPlanPricingConfigs = structuredClone(current.billingPlanPricing ?? {})
      for (const [planId, pricingPatch] of Object.entries(updates.pricing) as Array<[
        BillingPlanId,
        Partial<BillingPlanPricing>,
      ]>) {
        const entry: BillingPlanPricing = {
          monthlyPrice: pricingPatch.monthlyPrice ?? null,
          currency: pricingPatch.currency ?? null,
        }
        if (entry.monthlyPrice === null && !entry.currency) {
          delete nextPricing[planId]
        } else {
          nextPricing[planId] = entry
        }
      }
      await this.systemSettingStore.set(BILLING_PLAN_PRICING_SETTING_KEY, nextPricing)
      current.billingPlanPricing = nextPricing
    }

    if (Object.keys(updates.products).length > 0) {
      const nextProducts: BillingPlanProductConfigs = structuredClone(current.billingPlanProducts ?? {})
      for (const [planId, product] of Object.entries(updates.products) as Array<[BillingPlanId, BillingPlanPaymentInfo]>) {
        const normalized = this.normalizeNullableString(product.creemProductId)
        if (!normalized) {
          delete nextProducts[planId]
        } else {
          nextProducts[planId] = { creemProductId: normalized }
        }
      }
      await this.systemSettingStore.set(BILLING_PLAN_PRODUCTS_SETTING_KEY, nextProducts)
      current.billingPlanProducts = nextProducts
    }
  }

  async ensureRegistrationAllowed(): Promise<void> {
    const settings = await this.getSettings()

    if (!settings.allowRegistration) {
      throw new BizException(ErrorCode.AUTH_FORBIDDEN, {
        message: '当前已关闭用户注册，请联系管理员获取访问权限。',
      })
    }

    if (settings.maxRegistrableUsers === null) {
      return
    }

    const totalUsers = await this.getTotalUserCount()
    if (totalUsers >= settings.maxRegistrableUsers) {
      throw new BizException(ErrorCode.AUTH_FORBIDDEN, {
        message: '用户注册数量已达到上限，请联系管理员。',
      })
    }
  }

  async getAuthModuleConfig(): Promise<{
    baseDomain: string
    socialProviders: SocialProvidersConfig
    oauthGatewayUrl: string | null
  }> {
    const settings = await this.getSettings()
    return {
      baseDomain: settings.baseDomain,
      socialProviders: this.buildSocialProviders(settings),
      oauthGatewayUrl: settings.oauthGatewayUrl,
    }
  }

  private parseSetting<T>(raw: unknown, schema: ZodType<T>, defaultValue: T): T {
    if (raw === null || raw === undefined) {
      return defaultValue
    }

    const parsed = schema.safeParse(raw)
    return parsed.success ? parsed.data : defaultValue
  }

  private buildSocialProviders(settings: SystemSettings): SocialProvidersConfig {
    const providers: SocialProvidersConfig = {}

    if (settings.oauthGoogleClientId && settings.oauthGoogleClientSecret) {
      providers.google = {
        clientId: settings.oauthGoogleClientId,
        clientSecret: settings.oauthGoogleClientSecret,
      }
    }

    if (settings.oauthGithubClientId && settings.oauthGithubClientSecret) {
      providers.github = {
        clientId: settings.oauthGithubClientId,
        clientSecret: settings.oauthGithubClientSecret,
      }
    }

    return providers
  }

  private normalizeNullableString(value: string | null | undefined): string | null {
    if (value === undefined || value === null) {
      return null
    }
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  private normalizeGatewayUrl(value: string | null | undefined): string | null {
    if (value === undefined || value === null) {
      return null
    }

    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return null
    }

    try {
      const url = new URL(trimmed)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null
      }

      const normalizedPath = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '')
      return `${url.origin}${normalizedPath}`
    } catch {
      return null
    }
  }

  private buildStats(settings: SystemSettings, totalUsers: number): SystemSettingStats {
    const remaining =
      settings.maxRegistrableUsers === null ? null : Math.max(settings.maxRegistrableUsers - totalUsers, 0)

    return {
      totalUsers,
      registrationsRemaining: remaining,
    }
  }

  private async getTotalUserCount(): Promise<number> {
    const [row] = await this.dbAccessor
      .get()
      .select({ total: sql<number>`count(*)` })
      .from(authUsers)
    return typeof row?.total === 'number' ? row.total : Number(row?.total ?? 0)
  }
}

const PLAN_OVERRIDE_ENTRY_SCHEMA = z.object({
  monthlyAssetProcessLimit: z.number().int().min(0).nullable().optional(),
  libraryItemLimit: z.number().int().min(0).nullable().optional(),
  maxUploadSizeMb: z.number().int().min(1).nullable().optional(),
  maxSyncObjectSizeMb: z.number().int().min(1).nullable().optional(),
})

const BILLING_PLAN_OVERRIDES_SCHEMA = z.record(z.string(), PLAN_OVERRIDE_ENTRY_SCHEMA).default({})

const PLAN_PRODUCT_ENTRY_SCHEMA = z.object({
  creemProductId: z.string().trim().min(1).optional(),
})

const BILLING_PLAN_PRODUCTS_SCHEMA = z.record(z.string(), PLAN_PRODUCT_ENTRY_SCHEMA).default({})

const PLAN_PRICING_ENTRY_SCHEMA = z.object({
  monthlyPrice: z.number().min(0).nullable().optional(),
  currency: z.string().trim().min(1).nullable().optional(),
})

const BILLING_PLAN_PRICING_SCHEMA = z.record(z.string(), PLAN_PRICING_ENTRY_SCHEMA).default({})

type PlanQuotaUpdateMap = Partial<Record<BillingPlanId, Partial<BillingPlanQuota>>>
type PlanPricingUpdateMap = Partial<Record<BillingPlanId, Partial<BillingPlanPricing>>>
type PlanProductUpdateMap = Partial<Record<BillingPlanId, BillingPlanPaymentInfo>>

interface PlanFieldUpdateSummary {
  hasUpdates: boolean
  quotas: PlanQuotaUpdateMap
  pricing: PlanPricingUpdateMap
  products: PlanProductUpdateMap
}
