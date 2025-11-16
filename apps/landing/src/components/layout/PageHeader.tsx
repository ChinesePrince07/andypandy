'use client'

import { m, useMotionValueEvent, useScroll, useTransform } from 'motion/react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { NocturneButton } from '~/components/landing/NocturneButton'
import { blur, radius, transition } from '~/lib/design-tokens'
import { clsxm } from '~/lib/helper'

export const PageHeader = () => {
  const { scrollY } = useScroll()
  const [scrollPos, setScrollPos] = useState(0)

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrollPos(latest)
  })

  const scrolled = scrollPos > 60
  const headerOpacity = useTransform(scrollY, [0, 100], [0.95, 1])

  const headerClasses = useMemo(
    () =>
      clsxm(
        'pointer-events-auto relative flex items-center justify-between gap-3 overflow-hidden',
        radius.xl,
        'border pl-4 pr-2 py-2',
        transition.slow,
        scrolled
          ? 'border-white/15 bg-black/80 shadow-[0_20px_60px_rgba(0,0,0,0.5)]'
          : 'border-white/20 bg-white/5',
        blur['2xl'],
      ),
    [scrolled],
  )

  return (
    <m.header
      initial={{ opacity: 0, y: -40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-none fixed top-4 left-1/2 z-50 w-full max-w-6xl -translate-x-1/2 pl-4"
    >
      <m.div
        className={headerClasses}
        style={{
          opacity: headerOpacity,
        }}
      >
        {/* 背景渐变装饰 */}
        <div
          className={clsxm(
            'pointer-events-none absolute inset-0',
            scrolled
              ? 'bg-linear-to-r from-white/2 via-transparent to-white/2'
              : 'bg-linear-to-r from-white/3 via-transparent to-white/3',
          )}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent_70%)]" />

        {/* Logo 区域 */}
        <Link
          href="/"
          className="group relative z-10 flex items-center gap-2 transition-transform hover:scale-105"
        >
          <m.div
            className={clsxm(
              'flex size-9 items-center justify-center',
              radius.md,
              'border transition-all',
              scrolled
                ? 'border-white/25 bg-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.3)]'
                : 'border-white/20 bg-black/30',
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="font-serif text-sm tracking-widest text-white">
              AF
            </span>
          </m.div>
          <div className="hidden sm:block">
            <p
              className={clsxm(
                'text-[9px] tracking-[0.4em] uppercase transition-colors',
                scrolled ? 'text-white/50' : 'text-white/40',
              )}
            >
              Afilmory
            </p>
            <p className="text-xs font-medium text-white">
              {scrolled ? '夜色正在显影' : '暗夜影像策展馆'}
            </p>
          </div>
        </Link>

        {/* CTA 按钮组 */}
        <div className="relative z-10 flex items-center gap-2">
          <NocturneButton className="hidden px-5 py-2 text-xs lg:inline-flex">
            预约导览
          </NocturneButton>
          <NocturneButton
            variant="secondary"
            className="px-4 py-1.5 text-xs lg:hidden"
          >
            预约导览
          </NocturneButton>
        </div>
      </m.div>
    </m.header>
  )
}
