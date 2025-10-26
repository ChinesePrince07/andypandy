import { Button, FormError, Input, Label } from '@afilmory/ui'
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
      <div className="space-y-2">
        <Label htmlFor="tenant-name">Workspace name</Label>
        <Input
          id="tenant-name"
          value={tenant.name}
          onInput={(event) => onNameChange(event.currentTarget.value)}
          placeholder="Afilmory Studio"
          error={!!errors['tenant.name']}
          autoComplete="organization"
        />
        <FormError>{errors['tenant.name']}</FormError>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tenant-slug">Tenant slug</Label>
        <div className="flex gap-2">
          <Input
            id="tenant-slug"
            value={tenant.slug}
            onInput={(event) => onSlugChange(event.currentTarget.value)}
            placeholder="afilmory"
            error={!!errors['tenant.slug']}
            autoComplete="off"
          />
          <Button
            type="button"
            variant="ghost"
            className="rounded px-6 py-2.5 min-w-[120px] text-sm font-medium text-text-secondary hover:text-text hover:bg-fill/50 transition-all duration-200"
            onClick={onSuggestSlug}
          >
            Suggest
          </Button>
        </div>
        <FormError>{errors['tenant.slug']}</FormError>
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="tenant-domain">Custom domain (optional)</Label>
      <Input
        id="tenant-domain"
        value={tenant.domain}
        onInput={(event) => onDomainChange(event.currentTarget.value)}
        placeholder="gallery.afilmory.app"
        error={!!errors['tenant.domain']}
        autoComplete="off"
      />
      <FormError>{errors['tenant.domain']}</FormError>
      <p className="text-xs text-text-tertiary">
        Domains enable automatic routing for tenant-specific dashboards.
        Configure DNS separately after initialization.
      </p>
    </div>
  </form>
)
