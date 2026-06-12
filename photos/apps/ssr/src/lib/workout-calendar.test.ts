import { describe, expect, it } from 'vitest'

import { buildMonthGrid, computeStreak, dayKey, parseMonthParam, previousDay, shiftMonth } from './workout-calendar'

describe('dayKey', () => {
  it('buckets a late-evening UTC timestamp into the next Asia/Shanghai day', () => {
    // 18:30 UTC = 02:30 next day in UTC+8
    expect(dayKey('2026-06-12T18:30:00.000Z')).toBe('2026-06-13')
  })

  it('keeps a morning UTC timestamp on the same Asia/Shanghai day', () => {
    expect(dayKey('2026-06-12T03:00:00.000Z')).toBe('2026-06-12')
  })

  it('returns empty string for invalid input', () => {
    expect(dayKey('not-a-date')).toBe('')
  })
})

describe('buildMonthGrid', () => {
  it('lays out June 2026 Monday-first (June 1 is a Monday)', () => {
    const weeks = buildMonthGrid(2026, 6)
    expect(weeks[0][0]).toBe('2026-06-01')
    expect(weeks.at(-1)![1]).toBe('2026-06-30') // June 30 2026 is a Tuesday
    expect(weeks.at(-1)![2]).toBeNull()
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })

  it('pads leading days for a month not starting on Monday', () => {
    // May 1 2026 is a Friday → 4 leading nulls
    const weeks = buildMonthGrid(2026, 5)
    expect(weeks[0].slice(0, 4)).toEqual([null, null, null, null])
    expect(weeks[0][4]).toBe('2026-05-01')
  })
})

describe('computeStreak', () => {
  const days = new Set(['2026-06-10', '2026-06-11', '2026-06-12'])

  it('counts a run ending today', () => {
    expect(computeStreak(days, '2026-06-12')).toBe(3)
  })

  it("doesn't break when today's recap isn't uploaded yet", () => {
    expect(computeStreak(days, '2026-06-13')).toBe(3)
  })

  it('resets after a full missed day', () => {
    expect(computeStreak(days, '2026-06-14')).toBe(0)
  })

  it('handles gaps inside history', () => {
    const gappy = new Set(['2026-06-08', '2026-06-11', '2026-06-12'])
    expect(computeStreak(gappy, '2026-06-12')).toBe(2)
  })
})

describe('month param helpers', () => {
  it('parses valid YYYY-MM and rejects junk', () => {
    expect(parseMonthParam('2026-06')).toEqual({ year: 2026, month: 6 })
    expect(parseMonthParam('2026-13')).toBeNull()
    expect(parseMonthParam('06-2026')).toBeNull()
    expect(parseMonthParam(undefined)).toBeNull()
  })

  it('shifts across year boundaries', () => {
    expect(shiftMonth(2026, 1, -1)).toBe('2025-12')
    expect(shiftMonth(2026, 12, 1)).toBe('2027-01')
  })

  it('previousDay crosses month boundaries', () => {
    expect(previousDay('2026-06-01')).toBe('2026-05-31')
    expect(previousDay('2026-01-01')).toBe('2025-12-31')
  })
})
