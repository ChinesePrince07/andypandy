import { Button } from '@afilmory/ui'
import type { FC } from 'react'

type OnboardingFooterProps = {
  onBack: () => void
  onNext: () => void
  disableBack: boolean
  isSubmitting: boolean
  isLastStep: boolean
}

export const OnboardingFooter: FC<OnboardingFooterProps> = ({
  onBack,
  onNext,
  disableBack,
  isSubmitting,
  isLastStep,
}) => (
  <footer className="p-8 pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="text-xs text-text-tertiary">
      Need to revisit an earlier step? Use the sidebar or go back to adjust your
      inputs.
    </div>
    <div className="flex gap-2">
      <Button
        type="button"
        variant="ghost"
        className="rounded-lg px-6 py-2.5 min-w-[120px] text-sm font-medium text-text-secondary hover:text-text hover:bg-fill/50 transition-all duration-200"
        onClick={onBack}
        disabled={disableBack || isSubmitting}
      >
        Back
      </Button>
      <Button
        type="button"
        className="rounded-lg px-6 py-2.5 min-w-[140px] bg-accent text-white text-sm font-medium hover:bg-accent/90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all duration-200"
        onClick={onNext}
        isLoading={isSubmitting}
      >
        {isLastStep ? 'Initialize' : 'Continue'}
      </Button>
    </div>
  </footer>
)
