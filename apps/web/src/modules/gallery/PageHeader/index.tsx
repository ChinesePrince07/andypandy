import { PageHeaderCenter } from './PageHeaderCenter'
import { PageHeaderLeft } from './PageHeaderLeft'
import { PageHeaderRight } from './PageHeaderRight'
import { ViewModeSegment } from './ViewModeSegment'

interface PageHeaderProps {
  dateRange?: string
  location?: string
  showDateRange?: boolean
}

export const PageHeader = ({ dateRange, location, showDateRange }: PageHeaderProps) => {
  return (
    <header className="fixed top-0 right-0 left-0 z-100 border-b border-white/5 bg-black/80 backdrop-blur-xl">
      <div className="flex h-12 items-center justify-between gap-2 px-3 lg:h-12 lg:gap-3 lg:px-4">
        <PageHeaderLeft />
        <PageHeaderCenter dateRange={dateRange} location={location} showDateRange={showDateRange} />
        <div className="flex items-center gap-1.5 lg:gap-2">
          <ViewModeSegment />
          <PageHeaderRight />
        </div>
      </div>
    </header>
  )
}
