
import { MainPageLayout } from '~/components/layouts/MainPageLayout'
import { BuilderSettingsForm } from '~/modules/builder-settings'

export function Component() {
  return (
    <MainPageLayout title="构建器设置">
      <BuilderSettingsForm />
    </MainPageLayout>
  )
}
