import { authUsers, photoAssets, settings, tenantDomains } from '@afilmory/db'
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

    // Fetch photo counts for all tenants (only synced/conflict photos)
    const photoCounts = await db
      .select({
        tenantId: photoAssets.tenantId,
        count: sql<number>`count(*)::int`,
      })
      .from(photoAssets)
      .where(and(inArray(photoAssets.tenantId, tenantIds), inArray(photoAssets.syncStatus, ['synced', 'conflict'])))
      .groupBy(photoAssets.tenantId)

    // Fetch popular tags for all tenants
    // This query extracts tags from manifest JSONB and counts them per tenant
    // Process tags per tenant to ensure proper SQL parameterization
    const tagMap = new Map<string, string[]>()

    for (const tenantId of tenantIds) {
      const tagsResult = await db.execute<{ tag: string | null; count: number | null }>(sql`
        select tag, count(*)::int as count
        from (
          select nullif(trim(jsonb_array_elements_text(${photoAssets.manifest}->'data'->'tags')), '') as tag
          from ${photoAssets}
          where ${photoAssets.tenantId} = ${tenantId}
            and ${photoAssets.syncStatus} in ('synced', 'conflict')
        ) as tag_items
        where tag is not null and tag != ''
        group by tag
        order by count desc
        limit 5
      `)

      const tags = tagsResult.rows
        .map((row) => {
          const tag = row.tag?.trim()
          return tag && tag.length > 0 ? tag : null
        })
        .filter((tag): tag is string => tag !== null)

      if (tags.length > 0) {
        tagMap.set(tenantId, tags)
      }
    }

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

    const photoCountMap = new Map<string, number>()
    for (const count of photoCounts) {
      photoCountMap.set(count.tenantId, Number(count.count ?? 0))
    }

    // Build response
    const featuredGalleries = validTenants.map((aggregate) => {
      const { tenant } = aggregate
      const tenantSettings = settingsMap.get(tenant.id) ?? new Map()
      const author = authorMap.get(tenant.id)
      const domain = domainMap.get(tenant.id)
      const photoCount = photoCountMap.get(tenant.id) ?? 0
      const tags = tagMap.get(tenant.id) ?? []

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
        photoCount,
        tags,
        createdAt: normalizeDate(tenant.createdAt) ?? tenant.createdAt,
      }
    })

    return {
      galleries: featuredGalleries,
    }
  }
}
