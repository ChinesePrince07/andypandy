'use client'

import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry'

import { API_URL } from '~/constants/env'

interface FeaturedGalleryAuthor {
  name: string
  avatar: string | null
}

interface FeaturedGallery {
  id: string
  name: string
  slug: string
  domain: string | null
  description: string | null
  author: FeaturedGalleryAuthor | null
  photoCount: number
  tags: string[]
  createdAt: string
}

interface FeaturedGalleriesResponse {
  galleries: FeaturedGallery[]
}

const API_BASE_URL = API_URL.replace(/\/$/, '')
const FEATURED_GALLERIES_ENDPOINT = `${API_BASE_URL || ''}/featured-galleries`

async function fetchFeaturedGalleries(): Promise<FeaturedGalleriesResponse> {
  const response = await fetch(FEATURED_GALLERIES_ENDPOINT, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch featured galleries')
  }

  return response.json()
}

export const GalleryShowcase = () => {
  const t = useTranslations('GalleryShowcase')
  const locale = useLocale()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const { data, isLoading, error } = useQuery<FeaturedGalleriesResponse>({
    queryKey: ['featured-galleries'],
    queryFn: fetchFeaturedGalleries,
    enabled: mounted,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const galleries = data?.galleries ?? []

  const getBaseDomain = () => {
    if (typeof window === 'undefined') return 'afilmory.art'
    const { hostname } = window.location
    // Extract base domain from current hostname, or use default
    if (
      hostname.includes('.') &&
      !hostname.includes('localhost') &&
      !hostname.includes('127.0.0.1')
    ) {
      return hostname.split('.').slice(-2).join('.')
    }
    return 'afilmory.art'
  }

  const buildGalleryUrl = (gallery: FeaturedGallery) => {
    const { protocol } = window.location
    // Prefer custom domain, fallback to slug subdomain
    // if (gallery.domain) {
    //   return `${protocol}//${gallery.domain}`
    // }
    const baseDomain = getBaseDomain()
    return `${protocol}//${gallery.slug}.${baseDomain}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const localeMap: Record<string, string> = {
      'zh-CN': 'zh-CN',
      'zh-TW': 'zh-TW',
      'zh-HK': 'zh-HK',
      en: 'en-US',
      jp: 'ja-JP',
      ko: 'ko-KR',
    }
    const dateLocale = localeMap[locale] || 'en-US'
    return date.toLocaleDateString(dateLocale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (!mounted) {
    return null
  }

  return (
    <section id="gallery-showcase" className="space-y-10">
      <div className="text-center">
        <p className="text-xs tracking-[0.6em] text-white/40 uppercase">
          {t('eyebrow')}
        </p>
        <h2 className="mt-4 font-serif text-3xl text-white">{t('title')}</h2>
        <p className="mt-3 text-base text-white/70">{t('description')}</p>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-3xl border border-white/10 bg-white/5"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
          {t('error')}
        </div>
      )}

      {!isLoading && !error && galleries.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/60">
          {t('empty')}
        </div>
      )}

      {!isLoading && !error && galleries.length > 0 && (
        <ResponsiveMasonry
          columnsCountBreakPoints={{ 350: 1, 640: 2, 1024: 3 }}
        >
          <Masonry gutter="1rem">
            {galleries.map((gallery) => (
              <a
                key={gallery.id}
                href={buildGalleryUrl(gallery)}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block w-full overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-white/8 to-transparent p-6 transition hover:border-white/30 hover:bg-white/10"
              >
                {/* Author Avatar & Info */}
                {gallery.author && (
                  <div className="mb-4 flex items-center gap-3">
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                      {gallery.author.avatar ? (
                        <img
                          src={gallery.author.avatar}
                          alt={gallery.author.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                          }}
                        />
                      ) : null}
                      {(!gallery.author.avatar ||
                        gallery.author.avatar === '') && (
                        <div className="bg-accent-20 text-accent flex h-full w-full items-center justify-center">
                          <span className="text-sm font-medium">
                            {gallery.author.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {gallery.author.name}
                      </p>
                      <p className="truncate text-xs text-white/50">
                        {buildGalleryUrl(gallery)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Site Name */}
                <h3 className="group-hover:text-accent mb-2 font-serif text-xl text-white transition">
                  {gallery.name}
                </h3>

                {/* Description */}
                {gallery.description && (
                  <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-white/70">
                    {gallery.description}
                  </p>
                )}

                {/* Photo Count & Tags */}
                <div className="mb-4 space-y-2">
                  {gallery.photoCount > 0 && (
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <i className="i-lucide-image size-3.5" />
                      <span>
                        {gallery.photoCount}{' '}
                        <span>
                          {gallery.photoCount === 1 ? 'photo' : 'photos'}
                        </span>
                      </span>
                    </div>
                  )}
                  {gallery.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {gallery.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/70"
                        >
                          {tag}
                        </span>
                      ))}
                      {gallery.tags.length > 4 && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/50">
                          +{gallery.tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="mb-4 h-px w-full bg-linear-to-r from-transparent via-white/30 to-transparent opacity-50" />

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/40">
                    {formatDate(gallery.createdAt)}
                  </div>
                  <div className="text-white/30 transition group-hover:text-white/60">
                    <i className="i-lucide-external-link size-4" />
                  </div>
                </div>
              </a>
            ))}
          </Masonry>
        </ResponsiveMasonry>
      )}
    </section>
  )
}
