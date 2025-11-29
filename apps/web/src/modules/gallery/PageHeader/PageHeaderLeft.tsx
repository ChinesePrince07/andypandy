import * as AvatarPrimitive from '@radix-ui/react-avatar'

import { siteConfig } from '~/config'
import { usePhotos } from '~/hooks/usePhotoViewer'

import { resolveSocialUrl, SocialIconButton } from './utils'

export const PageHeaderLeft = () => {
  const visiblePhotoCount = usePhotos().length

  const githubUrl =
    siteConfig.social && siteConfig.social.github
      ? resolveSocialUrl(siteConfig.social.github, { baseUrl: 'https://github.com/' })
      : undefined
  const twitterUrl =
    siteConfig.social && siteConfig.social.twitter
      ? resolveSocialUrl(siteConfig.social.twitter, { baseUrl: 'https://twitter.com/', stripAt: true })
      : undefined
  const hasRss = siteConfig.social && siteConfig.social.rss

  const hasSocialLinks = githubUrl || twitterUrl || hasRss

  return (
    <div className="flex items-center gap-2 lg:gap-3">
      <div className="relative flex items-center gap-2 lg:gap-3">
        {siteConfig.author.avatar ? (
          <AvatarPrimitive.Root>
            <AvatarPrimitive.Image
              src={siteConfig.author.avatar}
              className="size-8 rounded-lg lg:size-9"
              alt={siteConfig.author.name}
            />
            <AvatarPrimitive.Fallback>
              <div className="flex size-8 items-center justify-center rounded-lg bg-white/10 lg:size-9">
                <i className="i-mingcute-camera-2-line text-base text-white/60 lg:text-lg" />
              </div>
            </AvatarPrimitive.Fallback>
          </AvatarPrimitive.Root>
        ) : (
          <div className="flex size-8 items-center justify-center rounded-lg bg-white/10 lg:size-9">
            <i className="i-mingcute-camera-2-line text-base text-white/60 lg:text-lg" />
          </div>
        )}
      </div>
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1.5 lg:gap-2">
          <h1 className="truncate text-base font-semibold text-white lg:text-lg">{siteConfig.name}</h1>
          <span className="text-xs text-white/40 lg:text-sm">{visiblePhotoCount}</span>
        </div>
        {hasSocialLinks && (
          <div className="flex items-center gap-2">
            {githubUrl && <SocialIconButton icon="i-mingcute-github-fill" title="GitHub" href={githubUrl} />}
            {twitterUrl && <SocialIconButton icon="i-mingcute-twitter-fill" title="Twitter" href={twitterUrl} />}
            {hasRss && <SocialIconButton icon="i-mingcute-rss-2-fill" title="RSS" href="/feed.xml" />}
          </div>
        )}
      </div>
    </div>
  )
}
