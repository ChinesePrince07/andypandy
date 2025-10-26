import type { FC } from 'react'

export const InitializedState: FC = () => (
  <div className="min-h-screen bg-background px-6 py-16">
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <header className="text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          Initialized
        </p>
        <h1 className="mt-6 text-4xl font-semibold text-text">
          Afilmory Control Center is ready
        </h1>
        <p className="mt-4 text-base text-text-secondary">
          Your workspace has already been provisioned. Sign in with an existing
          administrator account or invite new members from the dashboard.
        </p>
      </header>

      <div className="rounded-3xl border border-accent/20 bg-fill-secondary/50 p-8 backdrop-blur-2xl">
        <h2 className="text-lg font-semibold text-text mb-2">Next steps</h2>
        <ul className="space-y-3 text-sm text-text-secondary">
          <li className="flex items-start gap-3">
            <i className="i-mingcute-shield-user-fill mt-0.5 text-accent" />
            <span>
              Sign in as the tenant administrator you created during onboarding.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <i className="i-mingcute-lock-password-fill mt-0.5 text-accent" />
            <span>
              Look up the super administrator credentials printed in the core
              service logs if you have not already stored them.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <i className="i-mingcute-settings-3-fill mt-0.5 text-accent" />
            <span>
              Open the settings panel to refine integrations, email providers,
              and workspace preferences.
            </span>
          </li>
        </ul>
      </div>
    </div>
  </div>
)
