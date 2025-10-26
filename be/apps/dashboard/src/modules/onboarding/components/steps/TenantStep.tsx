import { Button } from '@afilmory/ui'
import { cx } from '@afilmory/utils'
import type { FC } from 'react'

import type { OnboardingErrors, TenantFormState } from '../../types'

type TenantStepProps = {
  tenant: TenantFormState
  errors: OnboardingErrors
  onNameChange: (value: string) => void
  onSlugChange: (value: string) => void
  onDomainChange: (value: string) => void
  onSuggestSlug: () => void
}

export const TenantStep: FC<TenantStepProps> = ({
  tenant,
  errors,
  onNameChange,
  onSlugChange,
  onDomainChange,
  onSuggestSlug,
}) => (
  <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <label className="text-sm font-medium text-text" htmlFor="tenant-name">
          Workspace name
        </label>
        <input
          id="tenant-name"
          value={tenant.name}
          onInput={(event) => onNameChange(event.currentTarget.value)}
          placeholder="Afilmory Studio"
          className={cx(
            'mt-2 w-full border border-fill-tertiary bg-background px-3 py-2 text-sm text-text placeholder:text-text-tertiary/70 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all duration-200',
            errors['tenant.name'] && 'border-red/60 focus:ring-red/30',
          )}
          autoComplete="organization"
        />
        {errors['tenant.name'] && (
          <p className="mt-1 text-xs text-red">{errors['tenant.name']}</p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-text" htmlFor="tenant-slug">
          Tenant slug
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="tenant-slug"
            value={tenant.slug}
            onInput={(event) => onSlugChange(event.currentTarget.value)}
            placeholder="afilmory"
            className={cx(
              'w-full border border-fill-tertiary bg-background px-3 py-2 text-sm text-text placeholder:text-text-tertiary/70 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all duration-200',
              errors['tenant.slug'] && 'border-red/60 focus:ring-red/30',
            )}
            autoComplete="off"
          />
          <Button
            type="button"
            variant="ghost"
            className="px-6 py-2.5 min-w-[120px] text-sm font-medium text-text-secondary hover:text-text hover:bg-fill/50 transition-all duration-200"
            onClick={onSuggestSlug}
          >
            Suggest
          </Button>
        </div>
        {errors['tenant.slug'] && (
          <p className="mt-1 text-xs text-red">{errors['tenant.slug']}</p>
        )}
      </div>
    </div>

    <div>
      <label className="text-sm font-medium text-text" htmlFor="tenant-domain">
        Custom domain (optional)
      </label>
      <input
        id="tenant-domain"
        value={tenant.domain}
        onInput={(event) => onDomainChange(event.currentTarget.value)}
        placeholder="gallery.afilmory.app"
        className={cx(
          'mt-2 w-full border border-fill-tertiary bg-background px-3 py-2 text-sm text-text placeholder:text-text-tertiary/70 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all duration-200',
          errors['tenant.domain'] && 'border-red/60 focus:ring-red/30',
        )}
        autoComplete="off"
      />
      {errors['tenant.domain'] && (
        <p className="mt-1 text-xs text-red">{errors['tenant.domain']}</p>
      )}
      <p className="mt-2 text-xs text-text-tertiary">
        Domains enable automatic routing for tenant-specific dashboards.
        Configure DNS separately after initialization.
      </p>
    </div>
  </form>
)
