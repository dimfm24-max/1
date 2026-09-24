import {
  minutesFromDayStart,
  overlappingTaskIds,
  type TaskCategoryDto,
  type TaskDto,
} from '@dilife/contracts'

/**
 * The geometry of the day timeline (task 15): where each timed task stands and how tall it is,
 * in minutes from the person's own day start. Pure, so the layout is tested without a browser.
 */

export const MINUTES_IN_DAY = 24 * 60
/** The grid a dragged or stretched block snaps to. */
export const GRID_MINUTES = 15

export type TimelineScale = {
  /** Pixels per minute. */
  pxPerMinute: number
  /** The shortest a block is drawn, so a 15-minute task stays a 44 px touch target. */
  minBlockPx: number
}

export const fullScale: TimelineScale = { pxPerMinute: 1.2, minBlockPx: 44 }
export const compactScale: TimelineScale = { pxPerMinute: 0.6, minBlockPx: 40 }

export type PlacedBlock = {
  task: TaskDto
  /** Minutes from the day start. */
  offset: number
  top: number
  height: number
  /** Which of `lanes` side-by-side columns the block takes. */
  lane: number
  lanes: number
  overlaps: boolean
}

/**
 * Timed tasks as blocks. Tasks whose drawn boxes touch share a group and stand side by side, so
 * two tasks at the same time are both visible. A block's drawn height, not only its duration,
 * decides the group: a 15-minute task drawn 44 px tall would otherwise cover its neighbour.
 */
export function layoutBlocks(
  tasks: ReadonlyArray<TaskDto>,
  dayStartMinute: number,
  scale: TimelineScale,
): PlacedBlock[] {
  const overlapping = overlappingTaskIds(tasks, dayStartMinute)
  const timed = tasks
    .filter((task): task is TaskDto & { startMinute: number } => task.startMinute !== null)
    .map((task) => {
      const offset = minutesFromDayStart(task.startMinute, dayStartMinute)
      // A block never runs past the end of the day: the rest of it is cut at the bottom.
      const minutes = Math.min(task.durationMinutes, MINUTES_IN_DAY - offset)
      const top = offset * scale.pxPerMinute
      const height = Math.max(minutes * scale.pxPerMinute, scale.minBlockPx)
      return { task, offset, top, height }
    })
    .sort((left, right) => left.top - right.top || left.task.position - right.task.position)

  const placed: PlacedBlock[] = []
  let group: Array<(typeof timed)[number] & { lane: number }> = []
  let groupBottom = -Infinity
  const flush = () => {
    const lanes = Math.max(1, ...group.map((block) => block.lane + 1))
    for (const block of group) {
      placed.push({ ...block, lanes, overlaps: overlapping.has(block.task.id) })
    }
    group = []
  }

  for (const block of timed) {
    if (block.top >= groupBottom) {
      flush()
      groupBottom = -Infinity
    }
    // The first lane whose last block has ended above this one.
    const laneBottoms: number[] = []
    for (const other of group) {
      laneBottoms[other.lane] = Math.max(laneBottoms[other.lane] ?? -Infinity, other.top + other.height)
    }
    let lane = laneBottoms.findIndex((bottom) => bottom <= block.top)
    if (lane === -1) lane = laneBottoms.length
    group.push({ ...block, lane })
    groupBottom = Math.max(groupBottom, block.top + block.height)
  }
  flush()
  return placed
}

/** A drag or stretch in pixels, turned into whole grid steps of minutes. */
export function snapMinutes(deltaPx: number, scale: TimelineScale): number {
  return Math.round(deltaPx / scale.pxPerMinute / GRID_MINUTES) * GRID_MINUTES
}

/** A block moved by `deltaMinutes`: the new start on the wall clock, kept inside the day. */
export function movedStart(
  startMinute: number,
  durationMinutes: number,
  deltaMinutes: number,
  dayStartMinute: number,
): number {
  const offset = minutesFromDayStart(startMinute, dayStartMinute) + deltaMinutes
  const latest = Math.max(0, MINUTES_IN_DAY - Math.min(durationMinutes, MINUTES_IN_DAY))
  const clamped = Math.min(Math.max(offset, 0), latest)
  return (clamped + dayStartMinute) % MINUTES_IN_DAY
}

/** A point on the timeline, in pixels from its top, as a wall-clock start on the grid. */
export function startAtOffset(offsetPx: number, dayStartMinute: number, scale: TimelineScale) {
  const minutes = snapMinutes(Math.max(offsetPx, 0), scale)
  const clamped = Math.min(minutes, MINUTES_IN_DAY - GRID_MINUTES)
  return (clamped + dayStartMinute) % MINUTES_IN_DAY
}

/** A stretched block's new length: at least one grid step, never past the end of the day. */
export function stretchedDuration(
  startMinute: number,
  durationMinutes: number,
  deltaMinutes: number,
  dayStartMinute: number,
): number {
  const offset = minutesFromDayStart(startMinute, dayStartMinute)
  const wanted = durationMinutes + deltaMinutes
  return Math.min(Math.max(wanted, GRID_MINUTES), MINUTES_IN_DAY - offset)
}

/** Where the "now" line stands, in pixels, for the person's wall-clock minute. */
export function nowOffset(minuteOfDay: number, dayStartMinute: number, scale: TimelineScale) {
  return minutesFromDayStart(minuteOfDay, dayStartMinute) * scale.pxPerMinute
}

/** The hour lines of the day, as wall-clock minutes, from the day start on. */
export function hourMarks(dayStartMinute: number): Array<{ minute: number; offset: number }> {
  const firstFullHour = Math.ceil(dayStartMinute / 60) * 60
  return Array.from({ length: 24 }, (_, index) => {
    const minute = (firstFullHour + index * 60) % MINUTES_IN_DAY
    return { minute, offset: minutesFromDayStart(minute, dayStartMinute) }
  }).filter((mark) => mark.offset < MINUTES_IN_DAY)
}

/** The drop targets of the day plan: the timeline itself and the «в течение дня» lane. */
export const timelineDropId = 'timeline'
export const unscheduledDropId = 'unscheduled'

/** The colour a task is drawn in: its own, else its category's, else none (task 14). */
export function taskColor(task: TaskDto, categories: ReadonlyArray<TaskCategoryDto>) {
  return (
    task.colorOverride ??
    categories.find((category) => category.id === task.categoryId)?.color ??
    null
  )
}
