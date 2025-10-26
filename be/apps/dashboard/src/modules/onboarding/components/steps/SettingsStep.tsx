import { Button } from '@afilmory/ui'
import { cx } from '@afilmory/utils'
import type { FC } from 'react'

import type { OnboardingSettingKey } from '../../constants'
import { ONBOARDING_SETTING_SECTIONS } from '../../constants'
import type { OnboardingErrors, SettingFormState } from '../../types'

type SettingsStepProps = {
  settingsState: SettingFormState
  errors: OnboardingErrors
  onToggle: (key: OnboardingSettingKey, enabled: boolean) => void
  onChange: (key: OnboardingSettingKey, value: string) => void
}

export const SettingsStep: FC<SettingsStepProps> = ({
  settingsState,
  errors,
  onToggle,
  onChange,
}) => (
  <div className="space-y-6">
    {ONBOARDING_SETTING_SECTIONS.map((section) => (
      <div
        key={section.id}
        className="border border-fill-tertiary bg-background p-6"
      >
        <header className="flex flex-col gap-1 mb-5">
          <h3 className="text-sm font-semibold text-text">{section.title}</h3>
          <p className="text-sm text-text-tertiary">{section.description}</p>
        </header>

        <div className="space-y-4">
          {section.fields.map((field) => {
            const state = settingsState[field.key]
            const errorKey = `settings.${field.key}`
            const hasError = Boolean(errors[errorKey])

            return (
              <div
                key={field.key}
                className="border border-fill-tertiary bg-fill p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text">
                      {field.label}
                    </p>
                    <p className="text-sm text-text-tertiary mt-1">
                      {field.description}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={state.enabled ? 'primary' : 'ghost'}
                    className={cx(
                      'rounded-xl px-6 py-2.5 min-w-[110px] text-sm font-medium transition-all duration-200',
                      state.enabled
                        ? 'bg-accent text-white hover:bg-accent/90'
                        : 'border border-fill-tertiary text-text-secondary hover:bg-fill-tertiary',
                    )}
                    onClick={() => onToggle(field.key, !state.enabled)}
                  >
                    {state.enabled ? 'Enabled' : 'Enable'}
                  </Button>
                </div>

                {state.enabled && (
                  <div className="mt-4">
                    {field.multiline ? (
                      <textarea
                        value={state.value}
                        onInput={(event) =>
                          onChange(field.key, event.currentTarget.value)
                        }
                        className={cx(
                          'w-full border border-fill-tertiary bg-background px-3 py-2 text-sm text-text placeholder:text-text-tertiary/70 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all duration-200',
                          hasError && 'border-red/60 focus:ring-red/30',
                        )}
                        rows={3}
                        placeholder={field.placeholder}
                      />
                    ) : (
                      <input
                        type={field.sensitive ? 'password' : 'text'}
                        value={state.value}
                        onInput={(event) =>
                          onChange(field.key, event.currentTarget.value)
                        }
                        placeholder={field.placeholder}
                        className={cx(
                          'w-full border border-fill-tertiary bg-background px-3 py-2 text-sm text-text placeholder:text-text-tertiary/70 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all duration-200',
                          hasError && 'border-red/60 focus:ring-red/30',
                        )}
                        autoComplete="off"
                      />
                    )}
                    {errors[errorKey] && (
                      <p className="mt-1 text-xs text-red">
                        {errors[errorKey]}
                      </p>
                    )}
                    {field.helper && (
                      <p className="mt-2 text-[11px] text-text-tertiary">
                        {field.helper}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    ))}
  </div>
)
