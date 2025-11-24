import { authUsers, settings, tenantDomains } from '@afilmory/db'
import { DbAccessor } from 'core/database/database.provider'
import { normalizeDate } from 'core/helpers/normalize.helper'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { injectable } from 'tsyringe'

import { TenantService } from '../tenant/tenant.service'

@injectable()
export class FeaturedGalleriesService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly dbAccessor: DbAccessor,
  ) {}

  async listFeaturedGalleries() {
    const aggregates = await this.tenantService.listTenants()

    // Filter out banned, inactive, and suspended tenants
    const validTenants = aggregates
      .filter((aggregate) => {
        const { tenant } = aggregate
        return !tenant.banned && tenant.status === 'active' && tenant.slug !== 'root' && tenant.slug !== 'placeholder'
      })
      .slice(0, 20) // Limit to 20 most recent

    const tenantIds = validTenants.map((aggregate) => aggregate.tenant.id)
    if (tenantIds.length === 0) {
      return { galleries: [] }
    }

    const db = this.dbAccessor.get()

    // Fetch site settings for all tenants
    const siteSettings = await db
      .select()
      .from(settings)
      .where(and(inArray(settings.tenantId, tenantIds), inArray(settings.key, ['site.name', 'site.description'])))

    // Fetch primary author (admin) for each tenant
    const authors = await db
      .select({
        tenantId: authUsers.tenantId,
        name: authUsers.name,
        image: authUsers.image,
      })
      .from(authUsers)
      .where(inArray(authUsers.tenantId, tenantIds))
      .orderBy(
        sql`case when ${authUsers.role} = 'admin' then 0 when ${authUsers.role} = 'superadmin' then 1 else 2 end`,
        asc(authUsers.createdAt),
      )

    // Fetch verified domains for all tenants
    const domains = await db
      .select({
        tenantId: tenantDomains.tenantId,
        domain: tenantDomains.domain,
      })
      .from(tenantDomains)
      .where(and(inArray(tenantDomains.tenantId, tenantIds), eq(tenantDomains.status, 'verified')))

    // Build maps for quick lookup
    const settingsMap = new Map<string, Map<string, string | null>>()
    for (const setting of siteSettings) {
      if (!settingsMap.has(setting.tenantId)) {
        settingsMap.set(setting.tenantId, new Map())
      }
      settingsMap.get(setting.tenantId)!.set(setting.key, setting.value)
    }

    const authorMap = new Map<string, { name: string; avatar: string | null }>()
    for (const author of authors) {
      if (!authorMap.has(author.tenantId!)) {
        authorMap.set(author.tenantId!, {
          name: author.name,
          avatar: author.image ?? null,
        })
      }
    }

    const domainMap = new Map<string, string>()
    for (const domain of domains) {
      // Use the first verified domain for each tenant
      if (!domainMap.has(domain.tenantId)) {
        domainMap.set(domain.tenantId, domain.domain)
      }
    }

    // Build response
    const featuredGalleries = validTenants.map((aggregate) => {
      const { tenant } = aggregate
      const tenantSettings = settingsMap.get(tenant.id) ?? new Map()
      const author = authorMap.get(tenant.id)
      const domain = domainMap.get(tenant.id)

      return {
        id: tenant.id,
        name: tenantSettings.get('site.name') ?? tenant.name,
        slug: tenant.slug,
        domain: domain ?? null,
        description: tenantSettings.get('site.description') ?? null,
        author: author
          ? {
              name: author.name,
              avatar: author.avatar,
            }
          : null,
        createdAt: normalizeDate(tenant.createdAt) ?? tenant.createdAt,
      }
    })

    return {
      galleries: featuredGalleries,
    }
  }
}
