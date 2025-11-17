import { PhotoLibraryGrid } from '../library/PhotoLibraryGrid'
import { PhotoLibraryProvider } from '../library/PhotoLibraryProvider'
import { PhotoPageScaffold } from '../PhotoPageScaffold'

export function PhotoLibraryTab() {
  return (
    <PhotoLibraryProvider isActive>
      <PhotoPageScaffold activeTab="library">
        <PhotoLibraryGrid />
      </PhotoPageScaffold>
    </PhotoLibraryProvider>
  )
}
