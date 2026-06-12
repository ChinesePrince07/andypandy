'use client'

import { useCallback, useEffect, useState } from 'react'

export interface DayPhoto {
  id: string
  thumbnailUrl: string
  originalUrl: string
  title: string
}

export interface CalendarDay {
  key: string
  dayNum: number
  isToday: boolean
  photos: DayPhoto[]
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function WorkoutCalendar({ weeks }: { weeks: (CalendarDay | null)[][] }) {
  const [lightbox, setLightbox] = useState<{ day: CalendarDay; index: number } | null>(null)

  const close = useCallback(() => setLightbox(null), [])

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') {
        setLightbox((prev) => prev && { ...prev, index: (prev.index + 1) % prev.day.photos.length })
      }
      if (e.key === 'ArrowLeft') {
        setLightbox(
          (prev) => prev && { ...prev, index: (prev.index - 1 + prev.day.photos.length) % prev.day.photos.length },
        )
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, close])

  return (
    <>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1 text-center text-[11px] font-medium text-neutral-600">
            {d}
          </div>
        ))}
        {weeks.flat().map((day, i) =>
          day === null ? (
            <div key={`pad-${i}`} />
          ) : day.photos.length > 0 ? (
            <button
              key={day.key}
              onClick={() => setLightbox({ day, index: 0 })}
              className={`group relative aspect-square overflow-hidden rounded-lg border transition-all hover:scale-[1.03] ${
                day.isToday ? 'border-orange-400/70' : 'border-neutral-800'
              }`}
              title={day.key}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={day.photos[day.photos.length - 1].thumbnailUrl}
                alt={`Workout on ${day.key}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white backdrop-blur-sm">
                {day.dayNum}
              </span>
              {day.photos.length > 1 && (
                <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white backdrop-blur-sm">
                  ×{day.photos.length}
                </span>
              )}
            </button>
          ) : (
            <div
              key={day.key}
              className={`flex aspect-square items-center justify-center rounded-lg border text-xs ${
                day.isToday ? 'border-orange-400/40 text-orange-400/70' : 'border-neutral-900 text-neutral-700'
              }`}
            >
              {day.dayNum}
            </div>
          ),
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[85vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.day.photos[lightbox.index].originalUrl}
              alt={lightbox.day.photos[lightbox.index].title || `Workout on ${lightbox.day.key}`}
              className="max-h-[80vh] w-auto rounded-lg object-contain"
            />
            <div className="mt-3 flex items-center justify-between text-sm text-neutral-400">
              <span>
                {lightbox.day.key}
                {lightbox.day.photos[lightbox.index].title ? ` · ${lightbox.day.photos[lightbox.index].title}` : ''}
              </span>
              {lightbox.day.photos.length > 1 && (
                <span className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setLightbox(
                        (prev) =>
                          prev && { ...prev, index: (prev.index - 1 + prev.day.photos.length) % prev.day.photos.length },
                      )
                    }
                    className="rounded px-2 py-0.5 hover:bg-white/10"
                  >
                    ‹
                  </button>
                  {lightbox.index + 1}/{lightbox.day.photos.length}
                  <button
                    onClick={() =>
                      setLightbox((prev) => prev && { ...prev, index: (prev.index + 1) % prev.day.photos.length })
                    }
                    className="rounded px-2 py-0.5 hover:bg-white/10"
                  >
                    ›
                  </button>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={close}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
      )}
    </>
  )
}
