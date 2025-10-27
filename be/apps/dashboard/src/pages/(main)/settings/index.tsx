import { Spring } from '@afilmory/utils'
import { m } from 'motion/react'

import { SettingsForm, SettingsNavigation } from '~/modules/settings'

export const Component = () => {
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={Spring.presets.smooth}
      className="space-y-6"
    >
      <header className="space-y-3">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold text-text">系统设置</h1>
          <p className="text-sm text-text-secondary">
            管理后台与核心功能的通用配置，修改后会立即同步生效。
          </p>
        </div>

        <SettingsNavigation active="general" />
      </header>

      <SettingsForm />
    </m.div>
  )
}
