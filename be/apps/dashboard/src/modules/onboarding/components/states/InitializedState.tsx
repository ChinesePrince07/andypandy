import type { FC } from 'react'

import { LinearBorderContainer } from '../LinearBorderContainer'

export const InitializedState: FC = () => (
  <div className="min-h-screen flex items-center justify-center px-6">
    <LinearBorderContainer tint="color-mix(in srgb, var(--color-yellow) 50%, transparent)">
      <div className="max-w-lg w-full bg-fill-secondary/60 p-8 text-center">
        <i className="i-mingcute-shield-user-fill mt-0.5 text-accent" />
        <h1 className="text-2xl font-semibold text-text mb-2">
          Afilmory Control Center is ready
        </h1>
        <p className="text-text-secondary text-sm">
          Your workspace has already been provisioned. Sign in with an existing
          administrator account or invite new members from the dashboard.
        </p>
      </div>
    </LinearBorderContainer>
  </div>
)
