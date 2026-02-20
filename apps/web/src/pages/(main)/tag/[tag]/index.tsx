import { useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { useParams } from 'react-router'

import { gallerySettingAtom } from '~/atoms/app'

export const Component = () => {
  const { tag } = useParams<{ tag: string }>()
  const setGallerySetting = useSetAtom(gallerySettingAtom)

  useEffect(() => {
    if (!tag) return
    setGallerySetting((prev) => ({
      ...prev,
      selectedTags: [decodeURIComponent(tag)],
    }))

    return () => {
      setGallerySetting((prev) => ({
        ...prev,
        selectedTags: [],
      }))
    }
  }, [tag, setGallerySetting])

  return null
}
