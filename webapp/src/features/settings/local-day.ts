/**
 * Which day it is for the person, worked out in the browser from their saved zone and day
 * start. It mirrors `backend/src/modules/settings/domain/local-day.ts`, so the screen can turn
 * over to the new day without asking the server; the server's answer, which arrives with the
 * settings, is the same rule applied at the moment of the request.
 */

/** Used until a zone is saved; the same fallback as on the server. */
export const FALLBACK_TIME_ZONE = 'Europe/Moscow'

export function isKnownTimeZone(name: string): boolean {
  if (name.trim() === '') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name })
    return true
  } catch {
    return false
  }
}

export function effectiveTimeZone(saved: string | null | undefined): string {
  return saved && isKnownTimeZone(saved) ? saved : FALLBACK_TIME_ZONE
}

/** The zone the browser reports, or null when it reports nothing usable. */
export function browserTimeZone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return zone && isKnownTimeZone(zone) ? zone : null
  } catch {
    return null
  }
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

export type WallClock = { date: string; minuteOfDay: number }

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

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

export type DayRule = { timeZone?: string | null; dayStartMinute: number }

/** The date of the plan being lived at `moment`: before the day start it is still yesterday. */
export function planDate(moment: Date, rule: DayRule): string {
  const clock = wallClock(moment, effectiveTimeZone(rule.timeZone))
  return clock.minuteOfDay < rule.dayStartMinute ? shiftDate(clock.date, -1) : clock.date
}
