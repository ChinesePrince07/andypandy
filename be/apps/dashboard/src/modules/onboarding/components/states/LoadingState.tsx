import type { FC } from 'react'

export const LoadingState: FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="rounded-3xl border border-accent/20 px-8 py-6 text-center shadow-2xl">
      <div className="flex items-center justify-center gap-3 text-text-secondary">
        <i className="i-mingcute-loading-3-fill animate-spin text-accent" />
        <span className="text-sm font-medium uppercase tracking-[0.3em] text-text-tertiary">
          Preparing onboarding experience
        </span>
      </div>
    </div>
  </div>
)
