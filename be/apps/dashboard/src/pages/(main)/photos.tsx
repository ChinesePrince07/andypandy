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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Photos</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage and organize your photo collection
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white transition-all duration-150 hover:bg-accent/90"
        >
          Upload Photos
        </button>
      </div>

      {/* Photo Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <m.div
            key={index}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...Spring.presets.smooth, delay: index * 0.05 }}
            className="group aspect-square overflow-hidden rounded-lg border border-border/50 bg-background-tertiary transition-all hover:border-border"
          >
            <div className="flex h-full items-center justify-center text-[13px] text-text-tertiary">
              Photo {index + 1}
            </div>
          </m.div>
        ))}
      </div>
    </m.div>
  )
}
