import { siteConfig } from '@config'
import { photoLoader } from '@photo-gallery/data'
import * as AvatarPrimitive from '@radix-ui/react-avatar'

import { clsxm } from '~/lib/cn'

import { ActionGroup } from './ActionGroup'

const numberFormatter = new Intl.NumberFormat('zh-CN')
const data = photoLoader.getPhotos()

export const MasonryHeaderMasonryItem = ({
  style,
  className,
}: {
  style?: React.CSSProperties
  className?: string
}) => {
  return (
    <div
      className={clsxm(
        'overflow-hidden border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900',
        className,
      )}
      style={style}
    >
      {/* Header section with clean typography */}
      <div className="px-6 pt-8 pb-6 text-center">
        <div className="flex items-center justify-center">
          <div className="relative">
            {siteConfig.author.avatar && (
              <AvatarPrimitive.Root>
                <AvatarPrimitive.Image
                  src={siteConfig.author.avatar}
                  className="size-16 rounded-full"
                />
                <AvatarPrimitive.Fallback>
                  <div className="bg-material-medium size-16 rounded-full" />
                </AvatarPrimitive.Fallback>
              </AvatarPrimitive.Root>
            )}
            <div
              className={clsxm(
                'from-accent to-accent/80 inline-flex items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg',
                siteConfig.author.avatar
                  ? 'size-8 rounded absolute bottom-0 -right-3'
                  : 'size-16 mb-4',
              )}
            >
              <i className="i-mingcute-camera-2-line text-2xl text-white" />
            </div>
          </div>
        </div>

        <h2 className="mb-1 text-2xl font-semibold text-gray-900 dark:text-white">
          {siteConfig.name}
        </h2>

        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {numberFormatter.format(data?.length || 0)} 张照片
        </p>
      </div>

      {/* Controls section */}
      <div className="px-6 pb-6">
        <ActionGroup />
      </div>

      {/* Footer with build date */}
      <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-800/50">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <i className="i-mingcute-calendar-line text-sm" />
          <span>
            构建于{' '}
            {new Date(BUILT_DATE).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>
    </div>
  )
}
