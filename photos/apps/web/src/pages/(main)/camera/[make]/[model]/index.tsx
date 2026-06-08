import { useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { useParams } from 'react-router'

import { gallerySettingAtom } from '~/atoms/app'

export const Component = () => {
  const { make, model } = useParams<{ make: string; model: string }>()
  const setGallerySetting = useSetAtom(gallerySettingAtom)

  useEffect(() => {
    if (!make || !model) return
    const displayName = `${decodeURIComponent(make)} ${decodeURIComponent(model)}`
    setGallerySetting((prev) => ({
      ...prev,
      selectedCameras: [displayName],
    }))

    return () => {
      setGallerySetting((prev) => ({
        ...prev,
        selectedCameras: [],
      }))
    }
  }, [make, model, setGallerySetting])

  return null
}
