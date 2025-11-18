import { Spring } from '@afilmory/utils'
import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { SuperAdminSettingsForm } from '~/modules/super-admin'

const PLAN_SECTION_IDS = ['billing-plan-settings'] as const

export function Component() {
  const { t } = useTranslation()
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={Spring.presets.smooth}
      className="space-y-6"
    >
      <header className="space-y-2">
        <h1 className="text-text text-2xl font-semibold">{t('superadmin.plans.title')}</h1>
        <p className="text-text-secondary text-sm">{t('superadmin.plans.description')}</p>
      </header>

      <SuperAdminSettingsForm visibleSectionIds={PLAN_SECTION_IDS} />
    </m.div>
  )
}
