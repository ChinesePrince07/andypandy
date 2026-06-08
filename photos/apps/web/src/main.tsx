import './styles/index.css'

import { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'

import { AppSkeleton } from './components/ui/app-skeleton'
import { router } from './router'

if (import.meta.env.DEV) {
  const { start } = await import('react-scan')
  start()
}

createRoot(document.querySelector('#root')!).render(
  <Suspense fallback={<AppSkeleton />}>
    <RouterProvider router={router} />
  </Suspense>,
)
