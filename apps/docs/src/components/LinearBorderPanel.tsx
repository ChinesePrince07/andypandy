import clsx from 'clsx'
import type { ReactNode } from 'react'

interface LinearBorderPanelProps {
  className?: string
  children: ReactNode
  variant?: 'default' | 'subtle' | 'accent'
}

export function LinearBorderPanel({ className, children, variant = 'default' }: LinearBorderPanelProps) {
  const variantClass = {
    default: 'border-line-default',
    subtle: 'border-line-subtle',
    accent: 'border-line-accent',
  }[variant]

  return (
    <div className={clsx('group relative overflow-hidden', variantClass, className)}>
      {/* Top border */}
      <div className="border-line-top absolute top-0 right-0 left-0 h-[0.5px]" />
      {/* Right border */}
      <div className="border-line-right absolute top-0 right-0 bottom-0 w-[0.5px]" />
      {/* Bottom border */}
      <div className="border-line-bottom absolute right-0 bottom-0 left-0 h-[0.5px]" />
      {/* Left border */}
      <div className="border-line-left absolute top-0 bottom-0 left-0 w-[0.5px]" />

      <div className="relative">{children}</div>
    </div>
  )
}

/**
 * Divider component - horizontal line separator
 */
export function Divider({
  className,
  variant = 'default',
}: {
  className?: string
  variant?: 'default' | 'subtle' | 'accent'
}) {
  const variantClass = {
    default: 'divider-default',
    subtle: 'divider-subtle',
    accent: 'divider-accent',
  }[variant]

  return <div className={clsx('h-[0.5px] w-full', variantClass, className)} />
}

/**
 * Vertical divider component
 */
export function VerticalDivider({
  className,
  variant = 'default',
}: {
  className?: string
  variant?: 'default' | 'subtle' | 'accent'
}) {
  const variantClass = {
    default: 'divider-vertical-default',
    subtle: 'divider-vertical-subtle',
    accent: 'divider-vertical-accent',
  }[variant]

  return <div className={clsx('h-full w-[0.5px]', variantClass, className)} />
}
