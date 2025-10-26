import type { FC } from 'react'

import { LinearBorderContainer } from '../LinearBorderContainer'

export const ErrorState: FC = () => (
  <div className="min-h-screen flex items-center justify-center px-6">
    <LinearBorderContainer tint="color-mix(in srgb, var(--color-red) 50%, transparent)">
      <div className="max-w-lg w-full bg-fill-secondary/60 p-8 text-center">
        <i className="i-mingcute-alert-fill text-red text-3xl mb-3" />
        <h1 className="text-2xl font-semibold text-text mb-2">
          Unable to connect
        </h1>
        <p className="text-text-secondary text-sm">
          The dashboard could not reach the core service. Ensure the backend is
          running and refresh the page.
        </p>
      </div>
    </LinearBorderContainer>
  </div>
)
