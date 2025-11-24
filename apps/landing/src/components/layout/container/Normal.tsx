import { clsxm } from '~/lib/helper'

export const NormalContainer: Component = (props) => {
  const { children, className } = props

  return (
    <div
      className={clsxm(
        'mx-auto pt-14 max-w-3xl px-2 lg:pt-[80px] lg:px-0 2xl:max-w-4xl',
        '[&_header.prose]:mb-[80px]',
        className,
      )}
    >
      {children}
    </div>
  )
}
