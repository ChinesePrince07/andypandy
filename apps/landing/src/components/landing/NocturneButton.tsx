'use client'

import type { ButtonHTMLAttributes } from 'react'

import { cn } from '~/lib/cn'

type NocturneButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}

export const NocturneButton = ({
  variant = 'primary',
  className,
  children,
  ...props
}: NocturneButtonProps) => {
  const variantStyles =
    variant === 'primary'
      ? 'border border-white/60 bg-linear-to-r from-[#f4efe6] via-[#ddd3c6] to-[#f4efe6] text-black shadow-[0_15px_60px_rgba(0,0,0,0.45)] hover:brightness-105'
      : 'border border-white/30 bg-black/20 text-white hover:border-white/60 hover:text-white'

  return (
    <button
      type="button"
      className={cn(
        'group relative inline-flex items-center gap-4 overflow-hidden rounded-full px-8 py-3 text-sm tracking-[0.4em] uppercase transition',
        variantStyles,
        className,
      )}
      {...props}
    >
      <span className="relative z-10 flex items-center gap-4">
        <span
          className={cn(
            'inline-flex size-6 items-center justify-center rounded-full border text-[0.55rem] tracking-[0.3em]',
            variant === 'primary'
              ? 'border-black/30 bg-black/5 text-black/70'
              : 'border-white/30 text-white/70',
          )}
        >
          AF
        </span>
        <span className="tracking-normal">{children}</span>
      </span>
      <span className="pointer-events-none absolute inset-0 rounded-full border border-white/10 opacity-40" />
      {variant === 'primary' ? (
        <span className="pointer-events-none absolute inset-0 bg-linear-to-r from-white/60 via-transparent to-white/60 opacity-40" />
      ) : (
        <span className="pointer-events-none absolute inset-0 bg-linear-to-r from-white/20 via-transparent to-white/20 opacity-30" />
      )}
    </button>
  )
}
