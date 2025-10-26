import type { FC, ReactNode } from 'react'

import { ONBOARDING_STEPS } from '../constants'
import { useOnboardingWizard } from '../hooks/useOnboardingWizard'
import { OnboardingFooter } from './OnboardingFooter'
import { OnboardingHeader } from './OnboardingHeader'
import { OnboardingSidebar } from './OnboardingSidebar'
import { ErrorState } from './states/ErrorState'
import { InitializedState } from './states/InitializedState'
import { LoadingState } from './states/LoadingState'
import { AdminStep } from './steps/AdminStep'
import { ReviewStep } from './steps/ReviewStep'
import { SettingsStep } from './steps/SettingsStep'
import { TenantStep } from './steps/TenantStep'
import { WelcomeStep } from './steps/WelcomeStep'

export const OnboardingWizard: FC = () => {
  const wizard = useOnboardingWizard()
  const {
    query,
    mutation,
    currentStepIndex,
    currentStep,
    goToNext,
    goToPrevious,
    jumpToStep,
    canNavigateTo,
    tenant,
    admin,
    settingsState,
    acknowledged,
    setAcknowledged,
    errors,
    updateTenantName,
    updateTenantSlug,
    suggestSlug,
    updateTenantDomain,
    updateAdminField,
    toggleSetting,
    updateSettingValue,
    reviewSettings,
  } = wizard

  if (query.isLoading) {
    return <LoadingState />
  }

  if (query.isError) {
    return <ErrorState />
  }

  if (query.data?.initialized) {
    return <InitializedState />
  }

  const stepContent: Record<typeof currentStep.id, ReactNode> = {
    welcome: <WelcomeStep />,
    tenant: (
      <TenantStep
        tenant={tenant}
        errors={errors}
        onNameChange={updateTenantName}
        onSlugChange={updateTenantSlug}
        onDomainChange={updateTenantDomain}
        onSuggestSlug={suggestSlug}
      />
    ),
    admin: (
      <AdminStep admin={admin} errors={errors} onChange={updateAdminField} />
    ),
    settings: (
      <SettingsStep
        settingsState={settingsState}
        errors={errors}
        onToggle={toggleSetting}
        onChange={updateSettingValue}
      />
    ),
    review: (
      <ReviewStep
        tenant={tenant}
        admin={admin}
        reviewSettings={reviewSettings}
        acknowledged={acknowledged}
        errors={errors}
        onAcknowledgeChange={setAcknowledged}
      />
    ),
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-7xl flex flex-row bg-background-tertiary">
        {/* Top border */}
        <div className="absolute left-0 right-0 h-[0.5px] bg-linear-to-r from-transparent via-text to-transparent" />

        {/* Left border */}
        <div className="absolute top-0 bottom-0 w-[0.5px] bg-linear-to-b from-transparent via-text to-transparent" />

        <div className="grid lg:grid-cols-[280px_1fr]">
          {/* Sidebar */}
          <div className="relative">
            <div className="absolute top-0 right-0 bottom-0 w-[0.5px] bg-text/20" />
            <OnboardingSidebar
              currentStepIndex={currentStepIndex}
              canNavigateTo={canNavigateTo}
              onStepSelect={jumpToStep}
            />
          </div>

          {/* Main content */}
          <main className="flex flex-col">
            <OnboardingHeader
              currentStepIndex={currentStepIndex}
              totalSteps={ONBOARDING_STEPS.length}
              step={currentStep}
            />

            {/* Horizontal divider */}
            <div className="h-[0.5px] bg-linear-to-r from-transparent via-text/30 to-transparent" />

            <section className="p-12">{stepContent[currentStep.id]}</section>

            {/* Horizontal divider */}
            <div className="h-[0.5px] bg-linear-to-r from-transparent via-text/30 to-transparent" />

            <OnboardingFooter
              onBack={goToPrevious}
              onNext={goToNext}
              disableBack={currentStepIndex === 0}
              isSubmitting={mutation.isPending}
              isLastStep={currentStepIndex === ONBOARDING_STEPS.length - 1}
            />
          </main>
        </div>
        <div className="flex flex-col shrink-0">
          {/* Right border */}
          <div className="absolute bottom-0 top-0 w-[0.5px] bg-linear-to-b from-transparent via-text to-transparent" />
        </div>
      </div>
      <div className="shrink-0 w-[2px]">
        {/* Bottom border */}
        <div className="absolute left-0 right-0 h-[0.5px] bg-linear-to-r from-transparent via-text to-transparent" />
      </div>
    </div>
  )
}
