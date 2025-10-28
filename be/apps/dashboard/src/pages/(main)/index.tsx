import { Spring } from '@afilmory/utils'
import { m } from 'motion/react'

import { MainPageLayout } from '~/components/layouts/MainPageLayout'

export const Component = () => {
  return (
    <MainPageLayout
      title="Dashboard"
      description="Welcome to your photo management dashboard"
    >
      <div className="space-y-6">
        {/* Stats Cards - Sharp Edges */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: 'Total Photos', value: '1,234', trend: '+12%' },
            { label: 'Storage Used', value: '45.2 GB', trend: '+8%' },
            { label: 'This Month', value: '156', trend: '+24%' },
          ].map((stat, index) => (
            <m.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...Spring.presets.smooth, delay: index * 0.1 }}
              className="relative bg-background-tertiary p-4"
            >
              {/* Gradient borders */}
              <div className="absolute left-0 top-0 right-0 h-[0.5px] bg-gradient-to-r from-transparent via-text/20 to-transparent" />
              <div className="absolute top-0 right-0 bottom-0 w-[0.5px] bg-gradient-to-b from-transparent via-text/20 to-transparent" />
              <div className="absolute left-0 bottom-0 right-0 h-[0.5px] bg-gradient-to-r from-transparent via-text/20 to-transparent" />
              <div className="absolute top-0 left-0 bottom-0 w-[0.5px] bg-gradient-to-b from-transparent via-text/20 to-transparent" />

              <div className="text-[11px] font-medium text-text-secondary">
                {stat.label}
              </div>
              <div className="mt-2 text-2xl font-semibold text-text">
                {stat.value}
              </div>
              <div className="mt-1 text-[11px] font-medium text-accent">
                {stat.trend} from last month
              </div>
            </m.div>
          ))}
        </div>

        {/* Recent Activity - Sharp Edges */}
        <div className="relative bg-background-tertiary p-4">
          {/* Gradient borders */}
          <div className="absolute left-0 top-0 right-0 h-[0.5px] bg-gradient-to-r from-transparent via-text/20 to-transparent" />
          <div className="absolute top-0 right-0 bottom-0 w-[0.5px] bg-gradient-to-b from-transparent via-text/20 to-transparent" />
          <div className="absolute left-0 bottom-0 right-0 h-[0.5px] bg-gradient-to-r from-transparent via-text/20 to-transparent" />
          <div className="absolute top-0 left-0 bottom-0 w-[0.5px] bg-gradient-to-b from-transparent via-text/20 to-transparent" />

          <h2 className="text-sm font-semibold text-text">Recent Activity</h2>
          <div className="mt-4 space-y-2">
            {[
              { action: 'Uploaded 23 photos', time: '2 hours ago' },
              { action: 'Created new album "Summer 2024"', time: '5 hours ago' },
              { action: 'Shared album with 3 people', time: '1 day ago' },
            ].map((activity) => (
              <div
                key={activity.action}
                className="flex items-center justify-between bg-fill/10 px-3 py-2 transition-colors hover:bg-fill/20"
              >
                <span className="text-[13px] text-text">{activity.action}</span>
                <span className="text-[11px] text-text-tertiary">
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainPageLayout>
  )
}
