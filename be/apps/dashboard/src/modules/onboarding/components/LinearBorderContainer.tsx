import { clsxm } from '@afilmory/utils'
import type { FC, ReactNode } from 'react'

type LinearBorderContainerProps = {
  children: ReactNode
  className?: string

  /**
   * Color tint for the border gradient.
   * @default 'text' - Uses the default text color
   * @example 'accent' - Uses the accent color
   * @example 'red' - Uses the red system color
   */
  tint?: string
}

/**
 * A container with linear gradient borders on all sides.
 * @example
 * ```tsx
 * <LinearBorderContainer  className="bg-background-tertiary">
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

  tint = 'var(--color-text)',
}) => {
  // Generate inline styles for gradients with dynamic tint color
  const horizontalGradient = {
    background: `linear-gradient(to right, transparent, ${tint}, transparent)`,
  }
  const verticalGradient = {
    background: `linear-gradient(to bottom, transparent, ${tint}, transparent)`,
  }

  // Advanced mode: uses flex layout for borders that span full dimensions
  return (
    <div className="flex flex-col">
      <div className={clsxm('flex flex-row', className)}>
        {/* Top border */}
        <div
          className="absolute left-0 right-0 h-[0.5px] z-1"
          style={horizontalGradient}
        />

        {/* Left border */}
        <div
          className="absolute top-0 bottom-0 w-[0.5px] z-1"
          style={verticalGradient}
        />

        {/* Main content area */}
        {children}

        {/* Right border container */}
        <div className="flex flex-col shrink-0">
          <div
            className="absolute bottom-0 top-0 w-[0.5px] z-1"
            style={verticalGradient}
          />
        </div>
      </div>

      {/* Bottom border container */}
      <div className="shrink-0 w-[2px]">
        <div
          className="absolute left-0 right-0 h-[0.5px] z-1"
          style={horizontalGradient}
        />
      </div>
    </div>
  )
}
