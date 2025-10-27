import { Spring } from '@afilmory/utils'
import { m } from 'motion/react'

export const Component = () => {
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={Spring.presets.smooth}
      className="space-y-6"
    >
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">Analytics</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Track your photo collection statistics and trends
        </p>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Upload Trends */}
        <div className="rounded-lg border border-border/50 bg-background-tertiary p-5">
          <h2 className="mb-4 text-sm font-semibold text-text">
            Upload Trends
          </h2>
          <div className="flex h-64 items-center justify-center text-[13px] text-text-tertiary">
            Chart placeholder
          </div>
        </div>

        {/* Storage Usage */}
        <div className="rounded-lg border border-border/50 bg-background-tertiary p-5">
          <h2 className="mb-4 text-sm font-semibold text-text">
            Storage Usage
          </h2>
          <div className="flex h-64 items-center justify-center text-[13px] text-text-tertiary">
            Chart placeholder
          </div>
        </div>

        {/* Popular Tags */}
        <div className="rounded-lg border border-border/50 bg-background-tertiary p-5">
          <h2 className="mb-4 text-sm font-semibold text-text">Popular Tags</h2>
          <div className="space-y-1.5">
            {[
              { tag: 'Nature', count: 234 },
              { tag: 'Travel', count: 189 },
              { tag: 'Portrait', count: 156 },
              { tag: 'Architecture', count: 142 },
            ].map((item) => (
              <div
                key={item.tag}
                className="flex items-center justify-between rounded-md bg-fill/10 px-3 py-2 transition-colors hover:bg-fill/20"
              >
                <span className="text-[13px] text-text">{item.tag}</span>
                <span className="text-[13px] font-medium text-accent">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Device Stats */}
        <div className="rounded-lg border border-border/50 bg-background-tertiary p-5">
          <h2 className="mb-4 text-sm font-semibold text-text">Top Devices</h2>
          <div className="space-y-1.5">
            {[
              { device: 'iPhone 15 Pro', count: 456 },
              { device: 'Canon EOS R5', count: 342 },
              { device: 'Sony A7 IV', count: 287 },
              { device: 'Fujifilm X-T5', count: 149 },
            ].map((item) => (
              <div
                key={item.device}
                className="flex items-center justify-between rounded-md bg-fill/10 px-3 py-2 transition-colors hover:bg-fill/20"
              >
                <span className="text-[13px] text-text">{item.device}</span>
                <span className="text-[13px] font-medium text-accent">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </m.div>
  )
}
