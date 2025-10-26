import { cx } from '@afilmory/utils'
import type { FC } from 'react'

import type { OnboardingStepId } from '../constants'
import { ONBOARDING_STEPS } from '../constants'
import { stepProgress } from '../utils'

type OnboardingSidebarProps = {
  currentStepIndex: number
  canNavigateTo: (index: number) => boolean
  onStepSelect: (index: number) => void
}

export const OnboardingSidebar: FC<OnboardingSidebarProps> = ({
  currentStepIndex,
  canNavigateTo,
  onStepSelect,
}) => (
  <aside className="hidden flex-col gap-6 p-6 lg:flex min-h-full">
    <div>
      <p className="text-xs font-medium text-accent">
        Setup Journey
      </p>
      <h2 className="mt-2 text-base font-semibold text-text">
        Launch your photo platform
      </h2>
    </div>
    <div className="space-y-2">
      {ONBOARDING_STEPS.map((step, index) => {
        const status: 'done' | 'current' | 'pending' =
          index < currentStepIndex
            ? 'done'
            : index === currentStepIndex
              ? 'current'
              : 'pending'

        return (
          <button
            key={step.id}
            type="button"
            className={cx(
              'w-full px-4 py-3 text-left transition-all duration-200',
              status === 'done' && 'bg-accent/5 text-text hover:bg-accent/10',
              status === 'current' && 'bg-accent/10 text-text',
              status === 'pending' && 'text-text-tertiary hover:bg-fill/50',
              !canNavigateTo(index) && 'cursor-default opacity-60',
            )}
            onClick={() => {
              if (canNavigateTo(index)) {
                onStepSelect(index)
              }
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className={cx(
                  'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200',
                  status === 'done' && 'bg-accent text-white',
                  status === 'current' && 'bg-accent text-white',
                  status === 'pending' && 'bg-fill text-text-tertiary',
                )}
              >
                {status === 'done' ? (
                  <i className="i-mingcute-check-fill text-sm" />
                ) : (
                  index + 1
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-text-tertiary truncate">{step.description}</p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
    <div className="mt-auto pt-4">
      {/* Horizontal divider */}
      <div className="h-[0.5px] bg-linear-to-r from-transparent via-text/30 to-transparent mb-4" />
      
      <div className="flex items-center justify-between text-xs text-text-tertiary mb-2">
        <span>Progress</span>
        <span className="font-medium">{stepProgress(currentStepIndex)}%</span>
      </div>
      <div className="relative h-1 bg-fill/30">
        <div
          className="absolute top-0 left-0 h-full bg-accent transition-all duration-300"
          style={{ width: `${stepProgress(currentStepIndex)}%` }}
        />
      </div>
    </div>
  </aside>
)
