/**
 * When a habit is due, and how long it has been kept.
 *
 * The product's rule: missing a day the habit was due breaks the streak, and a day it was never
 * due does not. A habit through every third day is not broken by the two days between.
 */

export type HabitPlan = {
  schedule: 'daily' | 'weekdays' | 'interval'
  weekdays: ReadonlyArray<number>
  intervalDays: number
  startedOn: string
}

const dayMs = 24 * 60 * 60 * 1000

function toUtc(date: string) {
  return Date.parse(`${date}T00:00:00.000Z`)
}

export function shiftDate(date: string, days: number): string {
  return new Date(toUtc(date) + days * dayMs).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / dayMs)
}

/** Whether the habit is expected on that day. Days before it started are never due. */
export function isDueOn(plan: HabitPlan, date: string): boolean {
  const offset = daysBetween(plan.startedOn, date)
  if (offset < 0) return false

  if (plan.schedule === 'daily') return true
  if (plan.schedule === 'weekdays') {
    const weekday = new Date(toUtc(date)).getUTCDay()
    return plan.weekdays.includes(weekday)
  }
  // An interval counts from the start date, so the anchor never drifts when a mark is added or
  // removed: the same calendar days stay due however the habit has been kept.
  return plan.intervalDays > 0 && offset % plan.intervalDays === 0
}

/**
 * The run of due days kept without a gap, counted back from today.
 *
 * Today is not counted against the person while it is still running: a habit due today but not
 * yet done keeps yesterday's streak until the day ends. Nagging at 9am about a day that has
 * barely started is what makes people abandon the streak entirely.
 */
export function currentStreak(
  plan: HabitPlan,
  marks: ReadonlySet<string>,
  today: string,
): number {
  let streak = 0
  let cursor = today

  // A due today that is not yet done is skipped rather than ending the count.
  if (isDueOn(plan, cursor) && !marks.has(cursor)) {
    cursor = shiftDate(cursor, -1)
  }

  while (daysBetween(plan.startedOn, cursor) >= 0) {
    if (isDueOn(plan, cursor)) {
      if (!marks.has(cursor)) break
      streak += 1
    }
    cursor = shiftDate(cursor, -1)
  }

  return streak
}

/**
 * The longest run ever kept, so a broken streak leaves something to beat rather than only the
 * memory of having done better.
 */
export function longestStreak(
  plan: HabitPlan,
  marks: ReadonlySet<string>,
  today: string,
): number {
  let longest = 0
  let running = 0

  for (
    let cursor = plan.startedOn;
    daysBetween(cursor, today) >= 0;
    cursor = shiftDate(cursor, 1)
  ) {
    if (!isDueOn(plan, cursor)) continue
    if (marks.has(cursor)) {
      running += 1
      longest = Math.max(longest, running)
      continue
    }
    // Today is still open: an unmarked due today ends the walk without breaking the record.
    if (cursor === today) break
    running = 0
  }

  return longest
}
