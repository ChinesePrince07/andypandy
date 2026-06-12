import siteConfig from '@config'
import Link from 'next/link'
import type { Metadata } from 'next'

import { getManifest } from '~/lib/manifest'
import {
  buildMonthGrid,
  computeStreak,
  dayKey,
  parseMonthParam,
  shiftMonth,
  todayKey,
  WORKOUT_TZ,
} from '~/lib/workout-calendar'

import { WorkoutCalendar, type CalendarDay, type DayPhoto } from './workout-calendar-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `Workout Log | ${siteConfig.title}`,
  description: 'Daily workout recaps, one screenshot per day.',
}

export default async function WorkoutPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: monthParam } = await searchParams

  // The public viewer filter strips workout photos from the GALLERY manifest;
  // this page intentionally shows them to everyone, so read the raw manifest
  // and select the workout set. Never throws: an R2 failure renders an empty
  // calendar rather than a 500.
  const workoutPhotos = await loadWorkoutPhotos()

  const byDay = new Map<string, DayPhoto[]>()
  for (const photo of workoutPhotos) {
    const key = dayKey(photo.dateTaken)
    if (!key) continue
    const entry: DayPhoto = {
      id: photo.id,
      thumbnailUrl: photo.thumbnailUrl || photo.originalUrl,
      originalUrl: photo.originalUrl,
      title: photo.title,
    }
    const list = byDay.get(key)
    if (list) list.push(entry)
    else byDay.set(key, [entry])
  }

  const today = todayKey()
  const fallback = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }
  const { year, month } = parseMonthParam(monthParam) ?? fallback

  const weeks: (CalendarDay | null)[][] = buildMonthGrid(year, month).map((week) =>
    week.map((key) =>
      key
        ? {
            key,
            dayNum: Number(key.slice(8, 10)),
            isToday: key === today,
            photos: byDay.get(key) ?? [],
          }
        : null,
    ),
  )

  const streak = computeStreak(new Set(byDay.keys()), today)
  const monthLabel = new Date(Date.UTC(year, month - 1, 1, 12)).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Workout Log</h1>
          {streak > 0 && (
            <span className="rounded-full bg-orange-500/10 px-3 py-1 text-sm font-medium text-orange-400">
              🔥 {streak} day{streak !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-neutral-500">One recap a day. Times are {WORKOUT_TZ}.</p>
      </header>

      <div className="mb-5 flex items-center justify-between">
        <Link
          href={`/workout?month=${shiftMonth(year, month, -1)}`}
          className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:border-neutral-600 hover:text-white"
        >
          ‹
        </Link>
        <h2 className="text-lg font-semibold">{monthLabel}</h2>
        <Link
          href={`/workout?month=${shiftMonth(year, month, 1)}`}
          className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:border-neutral-600 hover:text-white"
        >
          ›
        </Link>
      </div>

      <WorkoutCalendar weeks={weeks} />

      <footer className="mt-10 text-center text-xs text-neutral-600">
        <Link href="/" className="transition-colors hover:text-neutral-400">
          {siteConfig.title}
        </Link>
      </footer>
    </div>
  )
}

async function loadWorkoutPhotos() {
  try {
    const manifest = await getManifest()
    return manifest.data.filter((p) => p.isWorkout)
  } catch (error) {
    console.error('Failed to load manifest for /workout:', error)
    return []
  }
}
