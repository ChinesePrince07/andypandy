import { Spring } from '@afilmory/utils'
import { m } from 'motion/react'

import { SettingsNavigation } from '~/modules/settings'
import { StorageProvidersManager } from '~/modules/storage-providers'

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
          <h1 className="text-2xl font-semibold text-text">素材存储与 Builder</h1>
          <p className="text-sm text-text-secondary">
            在此配置多个素材存储提供商，并选择一个作为 Builder 的活跃源。保存后请重新运行 Builder 以加载最新配置。
          </p>
        </div>

        <SettingsNavigation active="storage" />
      </header>

      <StorageProvidersManager />
    </m.div>
  )
}
