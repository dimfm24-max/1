import type { TaskDto } from '@dilife/contracts'

/**
 * Reading a day for the screen. The rules are here rather than in the components so the plan,
 * the evening summary and the header cannot disagree about what counts as done.
 */

export type DayCounts = {
  total: number
  done: number
  burned: number
  unresolved: number
  donePercent: number
}

export function countDay(tasks: ReadonlyArray<TaskDto>): DayCounts {
  const done = tasks.filter((task) => task.outcome === 'done').length
  const burned = tasks.filter((task) => task.outcome === 'burned').length
  const unresolved = tasks.filter((task) => task.outcome === 'planned').length

  return {
    total: tasks.length,
    done,
    burned,
    unresolved,
    // Burned tasks count against the day: letting something go is an outcome, not a discount.
    donePercent: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
  }
}

/** Pairs of tasks whose times cross. Overlapping is allowed, so this marks rather than blocks. */
export function overlappingTaskIds(tasks: ReadonlyArray<TaskDto>): Set<string> {
  const timed = tasks
    .filter((task): task is TaskDto & { startMinute: number } => task.startMinute !== null)
    .sort((left, right) => left.startMinute - right.startMinute)

  const overlapping = new Set<string>()
  for (let index = 0; index < timed.length; index += 1) {
    const current = timed[index]!
    const currentEnd = current.startMinute + current.durationMinutes
    for (let next = index + 1; next < timed.length; next += 1) {
      const candidate = timed[next]!
      if (candidate.startMinute >= currentEnd) break
      overlapping.add(current.id)
      overlapping.add(candidate.id)
    }
  }
  return overlapping
}

/** 510 reads as 08:30. Minutes past midnight is how the day is stored; this is how it is said. */
export function formatMinuteOfDay(minute: number): string {
  const hours = Math.floor(minute / 60)
  const minutes = minute % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`
}

/** `YYYY-MM-DD` for a date in the viewer's own zone, which is the day they call today. */
export function toDayDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftDay(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

const weekdays = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
]

const months = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

/** "22 сентября, вторник" — the heading of the day, read the way it is spoken. */
export function formatDayHeading(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`)
  const day = parsed.getUTCDate()
  const month = months[parsed.getUTCMonth()] ?? ''
  const weekday = weekdays[parsed.getUTCDay()] ?? ''
  return `${day} ${month}, ${weekday}`
}

export function relativeDayLabel(date: string, today: string): string | null {
  if (date === today) return 'сегодня'
  if (date === shiftDay(today, 1)) return 'завтра'
  if (date === shiftDay(today, -1)) return 'вчера'
  return null
}
