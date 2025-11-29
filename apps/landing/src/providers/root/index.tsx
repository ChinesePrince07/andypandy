'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { LazyMotion } from 'motion/react'
import type { JSX, PropsWithChildren } from 'react'

import { ProviderComposer } from '../../components/common/ProviderComposer'
import { queryClient } from '../../lib/query-client'

const loadFeatures = () =>
  import('./framer-lazy-feature').then((res) => res.default)
const contexts: JSX.Element[] = [
  <QueryClientProvider key="queryClient" client={queryClient} />,
  <LazyMotion features={loadFeatures} strict key="framer" />,
]

export function Providers({ children }: PropsWithChildren) {
  return <ProviderComposer contexts={contexts}>{children}</ProviderComposer>
}
