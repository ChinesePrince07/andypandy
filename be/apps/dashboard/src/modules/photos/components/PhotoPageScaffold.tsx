import type { ReactNode } from 'react'

import { MainPageLayout } from '~/components/layouts/MainPageLayout'
import { PageTabs } from '~/components/navigation/PageTabs'

import { PhotoPageActions } from './PhotoPageActions'
import type { PhotoPageTab } from './PhotoPageTabs'
import { TAB_ROUTE_MAP } from './PhotoPageTabs'

type PhotoPageScaffoldProps = {
  activeTab: PhotoPageTab
  children: ReactNode
}

export function PhotoPageScaffold({ activeTab, children }: PhotoPageScaffoldProps) {
  return (
    <MainPageLayout title="照片库" description="在此同步和管理服务器中的照片资产。">
      <PhotoPageActions activeTab={activeTab} />

      <div className="space-y-4 sm:space-y-6">
        <PageTabs
          activeId={activeTab}
          items={[
            { id: 'library', label: '图库管理', to: TAB_ROUTE_MAP.library, end: true },
            { id: 'sync', label: '存储同步', to: TAB_ROUTE_MAP.sync, end: true },
            { id: 'storage', label: '素材存储', to: TAB_ROUTE_MAP.storage, end: true },
            { id: 'usage', label: '用量记录', to: TAB_ROUTE_MAP.usage, end: true },
          ]}
        />

        {children}
      </div>
    </MainPageLayout>
  )
}
