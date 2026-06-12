# Public workout calendar (supersedes private workout photos)

**Date:** 2026-06-13 · **Status:** Approved in conversation ("just start implementing")

Pivot from the 2026-06-12 private-photos spec: workout recap screenshots become
**public**, displayed on a calendar; they stay out of the main photo gallery.

## Decisions (Andy, 2026-06-13)

- **Workout category replaces Private.** `isHidden` is renamed `isWorkout`
  everywhere (no private photos exist yet, nothing is lost). Semantics:
  excluded from public gallery manifest, tag/camera/lens aggregates, OG and
  deep links — but publicly visible on the calendar. Admins still see them in
  the gallery with a badge.
- **Location:** `pics.andypandy.org/workout`, public, server-rendered in the
  ssr app (placed in the `(pages)` route group).
- **UI:** month grid (Mon–Sun), day cells show the day's screenshot thumbnail,
  click opens a client-side lightbox (Esc/click closes; multiple photos a day
  page within the lightbox). `?month=YYYY-MM` prev/next nav. Header shows a
  🔥 current-streak count (consecutive days ending today).
- **Timezone:** day bucketing + streak use fixed `Asia/Shanghai`.
- **Upload/edit toggles** relabeled "Workout (shows on calendar, not in
  gallery)". The admin-only `/admin/workout` timeline page is deleted; admin
  nav "Workout" points to the public `/workout`.
- Pure helpers (day bucketing, month grid, streak) live in
  `apps/ssr/src/lib/workout-calendar.ts` with unit tests; the renamed filter
  keeps its test suite.
- E2E: workout-flagged photo appears on public `/workout`, absent from public
  gallery manifest; streak counts it; cleanup after.
