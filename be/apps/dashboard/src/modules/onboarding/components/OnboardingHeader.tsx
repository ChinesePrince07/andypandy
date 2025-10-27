import type { FC } from 'react'

import type { OnboardingStep } from '../constants'

type OnboardingHeaderProps = {
  currentStepIndex: number
  totalSteps: number
  step: OnboardingStep
}

export const OnboardingHeader: FC<OnboardingHeaderProps> = ({
  currentStepIndex,
  totalSteps,
  step,
}) => (
  <header className="p-8 pb-6">
    <div className="rounded-lg inline-flex items-center gap-2 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent">
      Step {currentStepIndex + 1} of {totalSteps}
    </div>
    <h1 className="mt-4 text-3xl font-bold text-text">{step.title}</h1>
    <p className="mt-2 max-w-2xl text-sm text-text-secondary">
      {step.description}
    </p>
  </header>
)
