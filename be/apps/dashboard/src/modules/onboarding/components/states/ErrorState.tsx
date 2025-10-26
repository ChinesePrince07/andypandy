import type { FC } from 'react'

export const ErrorState: FC = () => (
  <div className="min-h-screen flex items-center justify-center px-6">
    <div
      className="max-w-lg w-full rounded-3xl border border-red/20 bg-fill-secondary/60 p-8 text-center backdrop-blur-2xl"
      style={{
        boxShadow:
          '0 22px 40px color-mix(in srgb, var(--color-red) 12%, transparent)',
      }}
    >
      <i className="i-mingcute-alert-fill text-red text-3xl mb-3" />
      <h1 className="text-2xl font-semibold text-text mb-2">
        Unable to connect
      </h1>
      <p className="text-text-secondary text-sm">
        The dashboard could not reach the core service. Ensure the backend is
        running and refresh the page.
      </p>
    </div>
  </div>
)
