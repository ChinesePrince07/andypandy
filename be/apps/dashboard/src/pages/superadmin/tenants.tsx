import { Spring } from '@afilmory/utils'
import { m } from 'motion/react'

import { SuperAdminTenantManager } from '~/modules/super-admin'

export function Component() {
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={Spring.presets.smooth}
      className="space-y-6"
    >
      <header className="space-y-2">
        <h1 className="text-text text-2xl font-semibold">租户订阅管理</h1>
        <p className="text-text-secondary text-sm">为特定租户切换订阅计划或封禁违规租户。</p>
      </header>

      <SuperAdminTenantManager />
    </m.div>
  )
}
