/**
 * Reading a day's shape. The rules live here because two screens ask the same questions - the
 * day plan and the evening summary - and a second copy of "what counts as done" would drift.
 */

export type ScheduledTask = {
  id: string
  startMinute: number | null
  durationMinutes: number
  outcome: 'planned' | 'done' | 'burned'
}

export type TaskOverlap = {
  first: string
  second: string
}

/**
 * Tasks whose times cross. Overlapping is allowed - a person may deliberately double-book - so
 * this reports rather than refuses, and the interface marks them.
 *
 * Only timed tasks can overlap: a task with no hour belongs to the day, not to a slot, and
 * pretending it collides with everything would make the whole day look like a conflict.
 */
export function findOverlaps(tasks: ReadonlyArray<ScheduledTask>): TaskOverlap[] {
  const timed = tasks
    .filter((task): task is ScheduledTask & { startMinute: number } => task.startMinute !== null)
    .sort((left, right) => left.startMinute - right.startMinute)

  const overlaps: TaskOverlap[] = []
  for (let index = 0; index < timed.length; index += 1) {
    const current = timed[index]!
    const currentEnd = current.startMinute + current.durationMinutes
    for (let next = index + 1; next < timed.length; next += 1) {
      const candidate = timed[next]!
      // Sorted by start, so once one starts at or after this one ends, every later one does too.
      if (candidate.startMinute >= currentEnd) break
      overlaps.push({ first: current.id, second: candidate.id })
    }
  }
  return overlaps
}

export type DaySummary = {
  planned: number
  done: number
  burned: number
  unresolved: number
  plannedMinutes: number
  doneMinutes: number
}

/**
 * What the evening summary says. `unresolved` is what the person is asked about: tasks still
 * open at the end of the day, each of which either moves or is let go.
 */
export function summariseDay(tasks: ReadonlyArray<ScheduledTask>): DaySummary {
  const summary: DaySummary = {
    planned: 0,
    done: 0,
    burned: 0,
    unresolved: 0,
    plannedMinutes: 0,
    doneMinutes: 0,
  }

  for (const task of tasks) {
    summary.plannedMinutes += task.durationMinutes
    if (task.outcome === 'done') {
      summary.done += 1
      summary.doneMinutes += task.durationMinutes
      continue
    }
    if (task.outcome === 'burned') {
      summary.burned += 1
      continue
    }
    summary.planned += 1
    summary.unresolved += 1
  }

  return summary
}

/**
 * Where a new task goes when no time is given: after the last timed task, rounded to the next
 * quarter hour. A person adding tasks quickly gets a sequence rather than a pile at the day's
 * start, and quarter hours are how people say times out loud.
 */
export function suggestStartMinute(
  tasks: ReadonlyArray<ScheduledTask>,
  dayStartMinute: number,
): number {
  const lastEnd = tasks.reduce((latest, task) => {
    if (task.startMinute === null) return latest
    return Math.max(latest, task.startMinute + task.durationMinutes)
  }, dayStartMinute)

  const rounded = Math.ceil(lastEnd / 15) * 15
  return Math.min(rounded, 24 * 60 - 1)
}
