import { useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { useParams } from 'react-router'

import { gallerySettingAtom } from '~/atoms/app'

export const Component = () => {
  const { lensName } = useParams<{ lensName: string }>()
  const setGallerySetting = useSetAtom(gallerySettingAtom)

  useEffect(() => {
    if (!lensName) return
    setGallerySetting((prev) => ({
      ...prev,
      selectedLenses: [decodeURIComponent(lensName)],
    }))

    return () => {
      setGallerySetting((prev) => ({
        ...prev,
        selectedLenses: [],
      }))
    }
  }, [lensName, setGallerySetting])

  return null
}
