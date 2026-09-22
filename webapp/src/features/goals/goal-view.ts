import type { GoalDto } from '@dilife/contracts'

/**
 * What the interface needs to draw a goal, derived once so the card, the list and the day screen
 * cannot disagree. The arithmetic itself belongs to the backend - this only reads what it sent.
 */
export type GoalView = {
  completionPercent: number
  completedSteps: number
  totalSteps: number
  daysLeft: number
  isOverdue: boolean
  isClosed: boolean
}

export function describeGoal(goal: GoalDto, now: Date): GoalView {
  const steps = goal.stages.flatMap((stage) => stage.steps)
  const completedSteps = steps.filter((step) => step.completedAt !== null).length
  const daysLeft = wholeDaysBetween(now, new Date(goal.deadline))
  const isClosed = goal.status !== 'active'

  return {
    completionPercent: percentOf(goal.currentValue, goal.targetValue),
    completedSteps,
    totalSteps: steps.length,
    daysLeft,
    // A closed goal is never overdue: it ended, on time or not, and saying otherwise would
    // nag about something already dealt with.
    isOverdue: !isClosed && daysLeft < 0,
    isClosed,
  }
}

function percentOf(currentValue: number, targetValue: number) {
  if (!(targetValue > 0)) return 0
  return Math.min(Math.round((currentValue / targetValue) * 100), 100)
}

/**
 * Whole days between two moments, counted from the start of each day, so a deadline reads the
 * same all day instead of dropping from 1 to 0 as the clock passes its time.
 */
function wholeDaysBetween(from: Date, to: Date) {
  const dayMs = 24 * 60 * 60 * 1000
  const startOfFrom = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  const startOfTo = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
  return Math.round((startOfTo - startOfFrom) / dayMs)
}

/** Russian day agreement: 1 день, 2 дня, 5 дней. */
export function formatDaysLeft(daysLeft: number): string {
  if (daysLeft < 0) return `просрочено на ${plural(Math.abs(daysLeft))}`
  if (daysLeft === 0) return 'последний день'
  return `осталось ${plural(daysLeft)}`
}

function plural(days: number) {
  const tail = days % 100
  if (tail >= 11 && tail <= 14) return `${days} дней`
  const last = days % 10
  if (last === 1) return `${days} день`
  if (last >= 2 && last <= 4) return `${days} дня`
  return `${days} дней`
}
