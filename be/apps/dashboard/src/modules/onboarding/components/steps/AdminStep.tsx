import { cx } from '@afilmory/utils'
import type { FC } from 'react'

import type { AdminFormState, OnboardingErrors } from '../../types'

type AdminStepProps = {
  admin: AdminFormState
  errors: OnboardingErrors
  onChange: <Field extends keyof AdminFormState>(
    field: Field,
    value: AdminFormState[Field],
  ) => void
}

export const AdminStep: FC<AdminStepProps> = ({ admin, errors, onChange }) => (
  <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <label className="text-sm font-medium text-text" htmlFor="admin-name">
          Administrator name
        </label>
        <input
          id="admin-name"
          value={admin.name}
          onInput={(event) => onChange('name', event.currentTarget.value)}
          placeholder="Studio Admin"
          autoComplete="name"
          className={cx(
            'mt-2 w-full border border-fill-tertiary bg-background px-3 py-2 text-sm text-text placeholder:text-text-tertiary/70 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all duration-200',
            errors['admin.name'] && 'border-red/60 focus:ring-red/30',
          )}
        />
        {errors['admin.name'] && (
          <p className="mt-1 text-xs text-red">{errors['admin.name']}</p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-text" htmlFor="admin-email">
          Administrator email
        </label>
        <input
          id="admin-email"
          value={admin.email}
          onInput={(event) => onChange('email', event.currentTarget.value)}
          placeholder="admin@afilmory.app"
          autoComplete="email"
          className={cx(
            'mt-2 w-full border border-fill-tertiary bg-background px-3 py-2 text-sm text-text placeholder:text-text-tertiary/70 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all duration-200',
            errors['admin.email'] && 'border-red/60 focus:ring-red/30',
          )}
        />
        {errors['admin.email'] && (
          <p className="mt-1 text-xs text-red">{errors['admin.email']}</p>
        )}
      </div>
    </div>

    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <label
          className="text-sm font-medium text-text"
          htmlFor="admin-password"
        >
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          value={admin.password}
          onInput={(event) => onChange('password', event.currentTarget.value)}
          placeholder="Minimum 8 characters"
          autoComplete="new-password"
          className={cx(
            'mt-2 w-full border border-fill-tertiary bg-background px-3 py-2 text-sm text-text placeholder:text-text-tertiary/70 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all duration-200',
            errors['admin.password'] && 'border-red/60 focus:ring-red/30',
          )}
        />
        {errors['admin.password'] && (
          <p className="mt-1 text-xs text-red">{errors['admin.password']}</p>
        )}
      </div>

      <div>
        <label
          className="text-sm font-medium text-text"
          htmlFor="admin-confirm"
        >
          Confirm password
        </label>
        <input
          id="admin-confirm"
          type="password"
          value={admin.confirmPassword}
          onInput={(event) =>
            onChange('confirmPassword', event.currentTarget.value)
          }
          placeholder="Repeat password"
          autoComplete="new-password"
          className={cx(
            'mt-2 w-full border border-fill-tertiary bg-background px-3 py-2 text-sm text-text placeholder:text-text-tertiary/70 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all duration-200',
            errors['admin.confirmPassword'] &&
              'border-red/60 focus:ring-red/30',
          )}
        />
        {errors['admin.confirmPassword'] && (
          <p className="mt-1 text-xs text-red">
            {errors['admin.confirmPassword']}
          </p>
        )}
      </div>
    </div>

    <p className="text-xs text-text-tertiary">
      After onboarding completes a global super administrator will also be
      generated. Those credentials are written to the backend logs for security
      reasons.
    </p>
  </form>
)
