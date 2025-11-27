import {
  authSessions,
  authUsers,
  commentReactions,
  comments,
  photoAssets,
  reactions,
  settings,
  tenantDomains,
  tenants,
} from '@afilmory/db'
import { EventEmitterService } from '@afilmory/framework'
import { DbAccessor } from 'core/database/database.provider'
import { BizException, ErrorCode } from 'core/errors'
import { BILLING_USAGE_EVENT } from 'core/modules/platform/billing/billing.constants'
import { BillingUsageService } from 'core/modules/platform/billing/billing-usage.service'
import { PLACEHOLDER_TENANT_SLUG, ROOT_TENANT_SLUG } from 'core/modules/platform/tenant/tenant.constants'
import { requireTenantContext } from 'core/modules/platform/tenant/tenant.context'
import { eq } from 'drizzle-orm'
import { injectable } from 'tsyringe'

@injectable()
export class DataManagementService {
  constructor(
    private readonly dbAccessor: DbAccessor,
    private readonly eventEmitter: EventEmitterService,
    private readonly billingUsageService: BillingUsageService,
  ) {}

  async clearPhotoAssetRecords(): Promise<{ deleted: number }> {
    const tenant = requireTenantContext()
    const db = this.dbAccessor.get()

    const deletedRecords = await db
      .delete(photoAssets)
      .where(eq(photoAssets.tenantId, tenant.tenant.id))
      .returning({ id: photoAssets.id })

    if (deletedRecords.length > 0) {
      await this.eventEmitter.emit('photo.manifest.changed', { tenantId: tenant.tenant.id })
      await this.billingUsageService.recordEvent({
        eventType: BILLING_USAGE_EVENT.PHOTO_ASSET_DELETED,
        quantity: -deletedRecords.length,
        metadata: {
          count: deletedRecords.length,
          source: 'tenant-management.clear-photo-assets',
        },
      })
    }

    return {
      deleted: deletedRecords.length,
    }
  }

  async deleteTenantAccount(): Promise<{ deletedTenantId: string }> {
    const tenant = requireTenantContext()
    const tenantId = tenant.tenant.id
    const tenantSlug = tenant.tenant.slug

    if (!tenantSlug) {
      throw new BizException(ErrorCode.COMMON_BAD_REQUEST, {
        message: '当前租户缺少 slug，无法删除账户。',
      })
    }

    if (tenantSlug === ROOT_TENANT_SLUG || tenantSlug === PLACEHOLDER_TENANT_SLUG) {
      throw new BizException(ErrorCode.AUTH_FORBIDDEN, {
        message: '系统租户无法通过此操作删除。',
      })
    }

    const db = this.dbAccessor.get()

    await db.transaction(async (tx) => {
      await tx.delete(photoAssets).where(eq(photoAssets.tenantId, tenantId))
      await tx.delete(reactions).where(eq(reactions.tenantId, tenantId))
      await tx.delete(settings).where(eq(settings.tenantId, tenantId))
      await tx.delete(tenantDomains).where(eq(tenantDomains.tenantId, tenantId))

      await tx.delete(comments).where(eq(comments.tenantId, tenantId))
      await tx.delete(commentReactions).where(eq(commentReactions.tenantId, tenantId))

      await tx.delete(authSessions).where(eq(authSessions.tenantId, tenantId))
      // await tx.delete(authAccounts).where(eq(authAccounts.tenantId, tenantId))
      await tx.delete(authUsers).where(eq(authUsers.tenantId, tenantId))
      await tx.delete(tenants).where(eq(tenants.id, tenantId))
    })

    return {
      deletedTenantId: tenantId,
    }
  }
}
