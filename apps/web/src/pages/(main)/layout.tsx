import { siteConfig } from '@config'
import { photoLoader } from '@photo-gallery/data'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import { Outlet, useParams, useSearchParams } from 'react-router'

import { gallerySettingAtom } from '~/atoms/app'
import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'
import { usePhotoViewer } from '~/hooks/usePhotoViewer'
import { MasonryRoot } from '~/modules/gallery/MasonryRoot'

export const Component = () => {
  useStateRestoreFromUrl()
  useSyncStateToUrl()
  useSyncStateToUrl()

  return (
    <>
      {siteConfig.accentColor && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
          :root:has(input.theme-controller[value=dark]:checked), [data-theme="dark"] {
            --color-primary: ${siteConfig.accentColor};
            --color-accent: ${siteConfig.accentColor};
            --color-secondary: ${siteConfig.accentColor};
          }
          `,
          }}
        />
      )}

      <ScrollArea
        rootClassName={'h-svh w-full transition-opacity duration-300'}
        viewportClassName="size-full"
      >
        <MasonryRoot />
      </ScrollArea>

      <Outlet />
    </>
  )
}

const useStateRestoreFromUrl = () => {
  const triggerOnceRef = useRef(false)

  const { openViewer } = usePhotoViewer()
  const { photoId } = useParams()
  const setGallerySetting = useSetAtom(gallerySettingAtom)

  const [searchParams] = useSearchParams()
  useEffect(() => {
    if (triggerOnceRef.current) return
    triggerOnceRef.current = true

    if (photoId) {
      const photo = photoLoader
        .getPhotos()
        .find((photo) => photo.id === photoId)
      if (photo) {
        openViewer(photoLoader.getPhotos().indexOf(photo))
      }
    }

    const tagsFromSearchParams = searchParams.get('tags')?.split(',')
    if (tagsFromSearchParams) {
      setGallerySetting((prev) => ({
        ...prev,
        selectedTags: tagsFromSearchParams,
      }))
    }
  }, [openViewer, photoId, searchParams, setGallerySetting])
}

const useSyncStateToUrl = () => {
  const { selectedTags } = useAtomValue(gallerySettingAtom)
  const [_, setSearchParams] = useSearchParams()

  useEffect(() => {
    const tags = selectedTags.join(',')
    if (tags) {
      setSearchParams((search) => {
        const currentTags = search.get('tags')
        if (currentTags === tags) return search

        const newer = new URLSearchParams(search)
        newer.set('tags', tags)
        return newer
      })
    } else {
      setSearchParams((search) => {
        const currentTags = search.get('tags')
        if (!currentTags) return search

        const newer = new URLSearchParams(search)
        newer.delete('tags')
        return newer
      })
    }
  }, [selectedTags, setSearchParams])
}
