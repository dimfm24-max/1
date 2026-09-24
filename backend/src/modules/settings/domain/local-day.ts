/**
 * Which day it is for a person. Every module that needs "today" - the day plan, habit streaks,
 * statistics, the public page, notifications - asks this rule, so they can never disagree.
 *
 * Two inputs shape the answer. The time zone turns a moment into a wall clock. The day start
 * decides when the plan turns over: with a 04:00 start, 02:30 still belongs to yesterday's plan.
 */

/**
 * Used while a person has no zone saved yet: accounts made before zones existed, until their
 * browser reports one. The interface is Russian only, so Moscow is the least wrong guess; the
 * choice is recorded in CHECKLIST.md.
 */
export const FALLBACK_TIME_ZONE = 'Europe/Moscow'

const MINUTES_IN_DAY = 24 * 60

/** True for a zone this server's time zone database knows. */
export function isKnownTimeZone(name: string): boolean {
  if (name.trim() === '') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name })
    return true
  } catch {
    return false
  }
}

/** The saved zone when it is usable, otherwise the fallback. Never throws. */
export function effectiveTimeZone(saved: string | null | undefined): string {
  return saved && isKnownTimeZone(saved) ? saved : FALLBACK_TIME_ZONE
}

export type WallClock = {
  /** `YYYY-MM-DD` on the calendar of the zone. */
  date: string
  /** Minutes past midnight on the wall clock of the zone. */
  minuteOfDay: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string) {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

/** What a clock on the wall in `timeZone` shows at `moment`, daylight saving included. */
export function wallClock(moment: Date, timeZone: string): WallClock {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(moment)
      .map((part) => [part.type, part.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

export function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

export type DayRule = {
  timeZone?: string | null
  dayStartMinute: number
}

/**
 * The date of the plan the person is living at `moment`. Before the day start the previous
 * plan is still open: a task at 01:00 with a 04:00 start sits at the end of yesterday's plan.
 */
export function planDate(moment: Date, rule: DayRule): string {
  const clock = wallClock(moment, effectiveTimeZone(rule.timeZone))
  const start = Math.min(Math.max(rule.dayStartMinute, 0), MINUTES_IN_DAY - 1)
  return clock.minuteOfDay < start ? shiftDate(clock.date, -1) : clock.date
}

/** Whole days from `from` to `to`, both `YYYY-MM-DD`. Negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const dayMs = 24 * 60 * 60 * 1000
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / dayMs)
}
