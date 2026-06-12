/**
 * Pure date helpers for the public /workout calendar. Day bucketing and
 * "today" are pinned to a fixed timezone so a late-evening workout doesn't
 * land on the next day's square when stored as UTC.
 */
export const WORKOUT_TZ = 'Asia/Shanghai'

/** ISO datetime → 'YYYY-MM-DD' in the workout timezone. '' for invalid input. */
export function dayKey(iso: string, tz: string = WORKOUT_TZ): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // en-CA formats as YYYY-MM-DD
  return d.toLocaleDateString('en-CA', { timeZone: tz })
}

/** Today's day key in the workout timezone. */
export function todayKey(tz: string = WORKOUT_TZ): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz })
}

function keyToUtcNoon(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

function utcNoonToKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** The day key immediately before `key`. */
export function previousDay(key: string): string {
  const d = keyToUtcNoon(key)
  d.setUTCDate(d.getUTCDate() - 1)
  return utcNoonToKey(d)
}

/**
 * Month grid for `year`/`month` (1-based month), Monday-first.
 * Returns weeks of 7 entries; each entry is a 'YYYY-MM-DD' key inside the
 * month, or null padding for leading/trailing cells.
 */
export function buildMonthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1, 12))
  const daysInMonth = new Date(Date.UTC(year, month, 0, 12)).getUTCDate()
  // getUTCDay(): 0=Sun..6=Sat → Monday-first column index 0..6
  const leadPad = (first.getUTCDay() + 6) % 7

  const cells: (string | null)[] = Array.from({ length: leadPad }, () => null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/**
 * Current streak: consecutive workout days ending today — or ending yesterday
 * when today's recap hasn't been uploaded yet (an in-progress day doesn't
 * break the streak).
 */
export function computeStreak(workoutDays: ReadonlySet<string>, today: string): number {
  let cursor = workoutDays.has(today) ? today : previousDay(today)
  let streak = 0
  while (workoutDays.has(cursor)) {
    streak++
    cursor = previousDay(cursor)
  }
  return streak
}

/** 'YYYY-MM' → {year, month}; null if malformed or out of range. */
export function parseMonthParam(value: string | undefined): { year: number; month: number } | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null
  return { year, month }
}

/** Adjacent month as 'YYYY-MM'. */
export function shiftMonth(year: number, month: number, delta: 1 | -1): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1, 12))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
