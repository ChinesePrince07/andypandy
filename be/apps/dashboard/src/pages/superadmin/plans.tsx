import { Spring } from '@afilmory/utils'
import { m } from 'motion/react'

import { SuperAdminSettingsForm } from '~/modules/super-admin'

const PLAN_SECTION_IDS = ['billing-plan-settings'] as const

export function Component() {
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={Spring.presets.smooth}
      className="space-y-6"
    >
      <header className="space-y-2">
        <h1 className="text-text text-2xl font-semibold">订阅计划配置</h1>
        <p className="text-text-secondary text-sm">
          管理各个订阅计划的资源配额、定价信息与 Creem Product 连接，仅超级管理员可编辑。
        </p>
      </header>

      <SuperAdminSettingsForm visibleSectionIds={PLAN_SECTION_IDS} />
    </m.div>
  )
}
