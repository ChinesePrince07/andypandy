import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIcon,
  CollapsibleTrigger,
  FormError,
  Input,
  Switch,
  Textarea,
} from '@afilmory/ui'
import { m } from 'motion/react'
import type { FC } from 'react'
import { useState } from 'react'

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
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set([ONBOARDING_SETTING_SECTIONS[0]?.id]),
  )

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  return (
    <div className="space-y-3 -m-10">
      {ONBOARDING_SETTING_SECTIONS.map((section) => {
        const isOpen = expandedSections.has(section.id)
        const enabledCount = section.fields.filter(
          (field) => settingsState[field.key].enabled,
        ).length

        return (
          <Collapsible
            key={section.id}
            open={isOpen}
            onOpenChange={() => toggleSection(section.id)}
            className="rounded-lg border border-fill-tertiary bg-background transition-all duration-200"
          >
            <CollapsibleTrigger className={'px-6 py-4 hover:bg-fill/30'}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-text">
                    {section.title}
                  </h3>
                  {enabledCount > 0 && (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                      {enabledCount} enabled
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-text-tertiary">
                  {section.description}
                </p>
              </div>
              <CollapsibleIcon className="ml-4 text-text-tertiary" />
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="space-y-3 border-t border-fill-tertiary p-6 pt-4">
                {section.fields.map((field) => {
                  const state = settingsState[field.key]
                  const errorKey = `settings.${field.key}`
                  const hasError = Boolean(errors[errorKey])

                  return (
                    <div
                      key={field.key}
                      className="rounded-lg border border-fill-tertiary bg-fill p-5 transition-all duration-200"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1">
                          <label
                            htmlFor={`switch-${field.key}`}
                            className="text-sm font-medium text-text cursor-pointer"
                          >
                            {field.label}
                          </label>
                          <p className="mt-1 text-sm text-text-tertiary">
                            {field.description}
                          </p>
                        </div>
                        <Switch
                          id={`switch-${field.key}`}
                          checked={state.enabled}
                          onCheckedChange={(checked) =>
                            onToggle(field.key, checked)
                          }
                          className="shrink-0"
                        />
                      </div>

                      {state.enabled && (
                        <m.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 space-y-2">
                            {field.multiline ? (
                              <Textarea
                                value={state.value}
                                onInput={(event) =>
                                  onChange(field.key, event.currentTarget.value)
                                }
                                rows={3}
                                placeholder={field.placeholder}
                                error={hasError}
                              />
                            ) : (
                              <Input
                                type={field.sensitive ? 'password' : 'text'}
                                value={state.value}
                                onInput={(event) =>
                                  onChange(field.key, event.currentTarget.value)
                                }
                                placeholder={field.placeholder}
                                error={hasError}
                                autoComplete="off"
                              />
                            )}
                            <FormError>{errors[errorKey]}</FormError>
                            {field.helper && (
                              <p className="text-[11px] text-text-tertiary">
                                {field.helper}
                              </p>
                            )}
                          </div>
                        </m.div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}
