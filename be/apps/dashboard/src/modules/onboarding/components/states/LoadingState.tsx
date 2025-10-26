import type { FC } from 'react'

import { LinearBorderContainer } from '../LinearBorderContainer'

export const LoadingState: FC = () => (
  <div className="min-h-screen flex items-center justify-center px-6">
    <LinearBorderContainer tint="color-mix(in srgb, var(--color-accent) 50%, transparent)">
      <div className="max-w-lg w-full bg-fill-secondary/60 p-8 text-center">
        <i className="i-mingcute-loading-3-fill animate-spin text-accent" />
        <h1 className="text-2xl font-semibold text-text mb-2">
          Preparing onboarding experience
        </h1>
        <p className="text-text-secondary text-sm">
          The dashboard is preparing the onboarding experience. Please wait a
          moment.
        </p>
      </div>
    </LinearBorderContainer>
  </div>
)
