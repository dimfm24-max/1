/**
 * The shape of a person's day, shared by the server's ordering and the screen's timeline so the
 * two can never disagree (tasks 02 and 15). A day runs from the person's own start, not from
 * midnight: with a 04:00 start a task at 01:00 is the last thing of the day, not the first.
 */

const MINUTES_IN_DAY = 24 * 60

/** How far into the person's day a wall-clock minute falls: 0 at the day start. */
export function minutesFromDayStart(startMinute: number, dayStartMinute: number): number {
  return (startMinute - dayStartMinute + MINUTES_IN_DAY) % MINUTES_IN_DAY
}

type Placed = {
  id: string
  startMinute: number | null
  durationMinutes: number
  position: number
}

/** Timed tasks by their place in the day, then the rest in the order they were added. */
export function compareTasksInDay(dayStartMinute: number) {
  return (left: Placed, right: Placed) => {
    if (left.startMinute === null && right.startMinute === null) {
      return left.position - right.position
    }
    if (left.startMinute === null) return 1
    if (right.startMinute === null) return -1
    const byTime =
      minutesFromDayStart(left.startMinute, dayStartMinute) -
      minutesFromDayStart(right.startMinute, dayStartMinute)
    return byTime === 0 ? left.position - right.position : byTime
  }
}

/**
 * Tasks whose times cross. Overlapping is allowed - a person may double-book on purpose - so this
 * marks rather than refuses. Counted in minutes from the day start, so 23:30 for an hour and
 * 00:15 cross even though midnight lies between them. Tasks without a time never overlap.
 */
export function overlappingTaskIds(
  tasks: ReadonlyArray<Placed>,
  dayStartMinute = 0,
): Set<string> {
  const timed = tasks
    .filter((task): task is Placed & { startMinute: number } => task.startMinute !== null)
    .map((task) => ({
      id: task.id,
      start: minutesFromDayStart(task.startMinute, dayStartMinute),
      duration: task.durationMinutes,
    }))
    .sort((left, right) => left.start - right.start)

  const overlapping = new Set<string>()
  for (let index = 0; index < timed.length; index += 1) {
    const current = timed[index]!
    const currentEnd = current.start + current.duration
    for (let next = index + 1; next < timed.length; next += 1) {
      const candidate = timed[next]!
      if (candidate.start >= currentEnd) break
      overlapping.add(current.id)
      overlapping.add(candidate.id)
    }
  }
  return overlapping
}

/** How a repeating thing picks its days (tasks 17 and 18). */
export type ScheduleRule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; weekdays: ReadonlyArray<number> }
  | { kind: 'monthdays'; monthDays: ReadonlyArray<number> }
  | { kind: 'dates'; dates: ReadonlyArray<string> }

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/**
 * Whether a rule lands on a day, `YYYY-MM-DD`. Weekdays count 0-6 from Sunday, as habits do.
 * The 29th-31st of a month fall on its last day when the month is shorter.
 */
export function ruleMatches(rule: ScheduleRule, date: string): boolean {
  const day = new Date(`${date}T00:00:00.000Z`)
  switch (rule.kind) {
    case 'daily':
      return true
    case 'weekdays':
      return rule.weekdays.includes(day.getUTCDay())
    case 'monthdays': {
      const dayOfMonth = day.getUTCDate()
      const last = daysInMonth(day.getUTCFullYear(), day.getUTCMonth())
      return rule.monthDays.some((wanted) =>
        wanted <= last ? wanted === dayOfMonth : dayOfMonth === last,
      )
    }
    case 'dates':
      return rule.dates.includes(date)
  }
}

/** Every day from `from` to `to` inclusive, both `YYYY-MM-DD`, on which the rule lands. */
export function ruleDates(rule: ScheduleRule, from: string, to: string): string[] {
  const out: string[] = []
  const cursor = new Date(`${from}T00:00:00.000Z`)
  const end = Date.parse(`${to}T00:00:00.000Z`)
  while (cursor.getTime() <= end) {
    const date = cursor.toISOString().slice(0, 10)
    if (ruleMatches(rule, date)) out.push(date)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}
