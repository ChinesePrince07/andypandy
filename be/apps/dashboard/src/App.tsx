import type { FC } from 'react'
import { Outlet } from 'react-router'

import { usePageRedirect } from '~/hooks/usePageRedirect'

import { Footer } from './components/common/Footer'
import { RootProviders } from './providers/root-providers'

export const App: FC = () => {
  return (
    <RootProviders>
      <AppLayer />
      <Footer />
    </RootProviders>
  )
}

const AppLayer = () => {
  usePageRedirect()

  const appIsReady = true
  return appIsReady ? <Outlet /> : <AppSkeleton />
}

const AppSkeleton = () => {
  return null
}
export default App
