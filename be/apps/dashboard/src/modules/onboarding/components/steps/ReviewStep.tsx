import { Checkbox } from '@afilmory/ui'
import type { FC } from 'react'

import type { SettingFieldDefinition } from '../../constants'
import type {
  AdminFormState,
  OnboardingErrors,
  TenantFormState,
} from '../../types'
import { maskSecret } from '../../utils'

export type ReviewSettingEntry = {
  definition: SettingFieldDefinition
  value: string
}

type ReviewStepProps = {
  tenant: TenantFormState
  admin: AdminFormState
  reviewSettings: ReviewSettingEntry[]
  acknowledged: boolean
  errors: OnboardingErrors
  onAcknowledgeChange: (checked: boolean) => void
}

export const ReviewStep: FC<ReviewStepProps> = ({
  tenant,
  admin,
  reviewSettings,
  acknowledged,
  errors,
  onAcknowledgeChange,
}) => (
  <div className="space-y-6">
    <div className="rounded border border-fill-tertiary bg-background p-6">
      <h3 className="text-sm font-semibold text-text mb-4">Tenant summary</h3>
      <dl className="grid gap-4 text-sm text-text-secondary sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-text">Name</dt>
          <dd className="mt-1">{tenant.name || '—'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-text">Slug</dt>
          <dd className="mt-1">{tenant.slug || '—'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-text">Domain</dt>
          <dd className="mt-1">{tenant.domain || 'Not configured'}</dd>
        </div>
      </dl>
    </div>

    <div className="rounded border border-fill-tertiary bg-background p-6">
      <h3 className="text-sm font-semibold text-text mb-4">Administrator</h3>
      <dl className="grid gap-4 text-sm text-text-secondary sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-text">Name</dt>
          <dd className="mt-1">{admin.name || '—'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-text">Email</dt>
          <dd className="mt-1">{admin.email || '—'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-text">Password</dt>
          <dd className="mt-1">{maskSecret(admin.password)}</dd>
        </div>
      </dl>
    </div>

    <div className="rounded border border-fill-tertiary bg-background p-6">
      <h3 className="text-sm font-semibold text-text mb-4">
        Enabled integrations
      </h3>
      {reviewSettings.length === 0 ? (
        <p className="text-sm text-text-tertiary">
          No integrations configured. You can enable OAuth providers, AI
          services, or maps later from the settings panel.
        </p>
      ) : (
        <ul className="space-y-3">
          {reviewSettings.map(({ definition, value }) => (
            <li
              key={definition.key}
              className="rounded border border-fill-tertiary bg-background px-4 py-3"
            >
              <p className="text-sm font-medium text-text">
                {definition.label}
              </p>
              <p className="mt-1 text-text-tertiary">
                {definition.sensitive ? maskSecret(value) : value}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>

    <div className="rounded border border-orange/40 bg-orange/5 p-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-orange mb-2">
        <i className="i-mingcute-alert-fill" />
        Important
      </h3>
      <p className="text-sm text-orange/90 leading-relaxed">
        Once you click initialize, the application becomes locked to this
        initial administrator. The core service will print super administrator
        credentials to stdout exactly once.
      </p>
      <label className="mt-4 flex items-start gap-3 text-sm text-text">
        <Checkbox
          checked={acknowledged}
          onCheckedChange={(checked) => onAcknowledgeChange(Boolean(checked))}
          className="mt-0.5"
        />
        <span>
          I have noted the super administrator credentials will appear in the
          backend logs and understand this action cannot be repeated.
        </span>
      </label>
      {errors['review.ack'] && (
        <p className="mt-2 text-xs text-red">{errors['review.ack']}</p>
      )}
    </div>
  </div>
)
