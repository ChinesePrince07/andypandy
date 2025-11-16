'use client'

import { m } from 'motion/react'

import { cn } from '~/lib/cn'

const floatingOrbs = [
  {
    size: 360,
    initial: { x: -200, y: -80, opacity: 0.35 },
    animate: { x: -160, y: -10, opacity: 0.6 },
    className: 'from-[#6A4DFB]/25 via-transparent to-transparent',
    duration: 18,
  },
  {
    size: 420,
    initial: { x: 240, y: 120, opacity: 0.2 },
    animate: { x: 200, y: 60, opacity: 0.45 },
    className: 'from-[#CBB28B]/35 via-transparent to-transparent',
    duration: 24,
  },
  {
    size: 280,
    initial: { x: -40, y: 360, opacity: 0.25 },
    animate: { x: 10, y: 310, opacity: 0.5 },
    className: 'from-[#2E2A40]/60 via-transparent to-transparent',
    duration: 30,
  },
]

const auroraBands = [
  {
    rotate: '-12deg',
    className: 'from-transparent via-white/5 to-transparent',
    delay: 0,
  },
  {
    rotate: '18deg',
    className: 'from-transparent via-purple-400/10 to-transparent',
    delay: 4,
  },
]

export const NocturneBackground = () => {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)]" />
      <div className="absolute inset-x-0 top-0 h-64 bg-linear-to-b from-black via-black/70 to-transparent" />

      {floatingOrbs.map((orb, index) => (
        <m.div
          key={index}
          initial={orb.initial}
          animate={orb.animate}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            repeatType: 'mirror',
            ease: 'easeInOut',
          }}
          className="absolute blur-[90px]"
        >
          <div
            className={cn('rounded-full bg-linear-to-br', orb.className)}
            style={{
              width: orb.size,
              height: orb.size,
            }}
          />
        </m.div>
      ))}

      {auroraBands.map((band) => (
        <m.div
          key={band.rotate}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.1, 0.4, 0.1], x: [-20, 20, -20] }}
          transition={{
            duration: 20,
            repeat: Infinity,
            delay: band.delay,
            ease: 'easeInOut',
          }}
          className="absolute inset-x-[-20%] top-1/4 h-56"
          style={{ rotate: band.rotate }}
        >
          <div
            className={cn(
              'h-full w-full rounded-[60px] bg-linear-to-r blur-[60px]',
              band.className,
            )}
          />
        </m.div>
      ))}

      <div className="absolute inset-0 opacity-40">
        {Array.from({ length: 20 }).map((_, idx) => (
          <m.div
            key={idx}
            className="absolute h-px w-32 bg-linear-to-r from-white/10 via-white/50 to-transparent"
            style={{
              top: `${(idx * 13) % 100}%`,
              left: `${(idx * 27) % 100}%`,
            }}
            initial={{ opacity: 0.2 }}
            animate={{ opacity: [0.1, 0.4, 0.15], x: [0, 20, 0] }}
            transition={{
              duration: 12 + idx * 0.3,
              repeat: Infinity,
              repeatType: 'mirror',
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </div>
  )
}
