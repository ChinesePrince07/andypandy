import type { FC, ReactNode } from 'react'

type LinearBorderBoxProps = {
  children: ReactNode
  className?: string
}

/**
 * A container with linear gradient borders on all sides.
 * Follows the design language from login page.
 */
export const LinearBorderBox: FC<LinearBorderBoxProps> = ({
  children,
  className = '',
}) => (
  <div className={`relative ${className}`}>
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

