import { clsxm } from '@afilmory/utils'
import type { FC, ReactNode } from 'react'

type LinearBorderContainerProps = {
  children: ReactNode
  className?: string
  /**
   * If true, uses the advanced flex layout that allows borders to span the full height/width.
   * This is needed when you have complex nested layouts (like grid) inside.
   *
   * If false, uses simple relative positioning (works for basic cases).
   */
  useAdvancedLayout?: boolean
}

/**
 * A container with linear gradient borders on all sides.
 *
 * **Two Layout Modes:**
 *
 * 1. **Simple mode** (`useAdvancedLayout={false}`, default):
 *    - Uses `position: relative` with absolutely positioned borders
 *    - Works for simple content without complex nested layouts
 *    - Borders may not span full height if content has complex flex/grid
 *
 * 2. **Advanced mode** (`useAdvancedLayout={true}`):
 *    - Uses flex layout with separate containers for right/bottom borders
 *    - Borders always span the full container dimensions
 *    - Required for complex nested layouts (like OnboardingWizard grid)
 *
 * @example
 * ```tsx
 * // Simple case (login form)
 * <LinearBorderContainer className="p-12">
 *   <form>...</form>
 * </LinearBorderContainer>
 *
 * // Complex case (onboarding wizard with grid)
 * <LinearBorderContainer useAdvancedLayout className="bg-background-tertiary">
 *   <div className="grid lg:grid-cols-[280px_1fr]">
 *     <Sidebar />
 *     <Content />
 *   </div>
 * </LinearBorderContainer>
 * ```
 */
export const LinearBorderContainer: FC<LinearBorderContainerProps> = ({
  children,
  className,
  useAdvancedLayout = false,
}) => {
  if (!useAdvancedLayout) {
    // Simple mode: works for basic content
    return (
      <div className={clsxm('relative', className)}>
        {/* Top border */}
        <div className="absolute left-0 top-0 right-0 h-[0.5px] bg-linear-to-r from-transparent via-text to-transparent" />

        {/* Right border */}
        <div className="absolute top-0 right-0 bottom-0 w-[0.5px] bg-linear-to-b from-transparent via-text to-transparent" />

        {/* Bottom border */}
        <div className="absolute left-0 bottom-0 right-0 h-[0.5px] bg-linear-to-r from-transparent via-text to-transparent" />

        {/* Left border */}
        <div className="absolute top-0 left-0 bottom-0 w-[0.5px] bg-linear-to-b from-transparent via-text to-transparent" />

        {children}
      </div>
    )
  }

  // Advanced mode: uses flex layout for borders that span full dimensions
  return (
    <div className="flex flex-col">
      <div className={clsxm('flex flex-row', className)}>
        {/* Top border */}
        <div className="absolute left-0 right-0 h-[0.5px] bg-linear-to-r from-transparent via-text to-transparent" />

        {/* Left border */}
        <div className="absolute top-0 bottom-0 w-[0.5px] bg-linear-to-b from-transparent via-text to-transparent" />

        {/* Main content area */}
        {children}

        {/* Right border container */}
        <div className="flex flex-col shrink-0">
          <div className="absolute bottom-0 top-0 w-[0.5px] bg-linear-to-b from-transparent via-text to-transparent" />
        </div>
      </div>

      {/* Bottom border container */}
      <div className="shrink-0 w-[2px]">
        <div className="absolute left-0 right-0 h-[0.5px] bg-linear-to-r from-transparent via-text to-transparent" />
      </div>
    </div>
  )
}
