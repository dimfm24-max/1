import type { GoalDto } from '@dilife/contracts'

import { formatDate, formatNumber, pluralForm } from '@/platform/intl'

/** Where a goal stands against its deadline, for the badge and the warning line. */
export type DeadlineState = 'on-track' | 'warning' | 'last-day' | 'overdue' | 'closed'

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
  deadlineState: DeadlineState
  /** «5 из 12 проектов», or «78 → 60 килограммов» for a goal that counts from a start. */
  measureLine: string
}

/** `today` is the person's own day, `YYYY-MM-DD`, by their time zone. */
export function describeGoal(goal: GoalDto, today: string): GoalView {
  const steps = goal.stages.flatMap((stage) => stage.steps)
  const completedSteps = steps.filter((step) => step.completedAt !== null).length
  const daysLeft = wholeDaysBetween(today, goal.deadline.slice(0, 10))
  const isClosed = goal.status !== 'active'
  const warningDays = goal.deadlineWarningDays ?? 3

  return {
    completionPercent: Math.round(goalRatio(goal) * 100),
    completedSteps,
    totalSteps: steps.length,
    daysLeft,
    // A closed goal is never overdue: it ended, on time or not, and saying otherwise would
    // nag about something already dealt with.
    isOverdue: !isClosed && daysLeft < 0,
    isClosed,
    deadlineState: isClosed
      ? 'closed'
      : daysLeft < 0
        ? 'overdue'
        : daysLeft === 0
          ? 'last-day'
          : daysLeft <= warningDays
            ? 'warning'
            : 'on-track',
    measureLine: measureLine(goal),
  }
}

/**
 * The share the server computed. A response from an older server has none, and then the plain
 * count from zero is the best reading of the same numbers.
 */
function goalRatio(goal: GoalDto): number {
  if (goal.progressRatio !== undefined) return goal.progressRatio
  if (!(goal.targetValue > 0)) return 0
  return Math.min(Math.max(goal.currentValue / goal.targetValue, 0), 1)
}

function measureLine(goal: GoalDto) {
  const start = goal.progressMode === 'manual' ? (goal.initialValue ?? null) : null
  if (start !== null) {
    return `${formatNumber(goal.currentValue)} → ${formatNumber(goal.targetValue)} ${goal.measureUnit}`
  }
  return `${formatNumber(goal.currentValue)} из ${formatNumber(goal.targetValue)} ${goal.measureUnit}`
}

/** Whole calendar days between two `YYYY-MM-DD` days, so a deadline reads the same all day. */
function wholeDaysBetween(from: string, to: string) {
  const dayMs = 24 * 60 * 60 * 1000
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / dayMs)
}

/** Russian day agreement: 1 день, 2 дня, 5 дней. */
export function formatDaysLeft(daysLeft: number): string {
  if (daysLeft < 0) return `просрочено на ${plural(Math.abs(daysLeft))}`
  if (daysLeft === 0) return 'последний день'
  return `осталось ${plural(daysLeft)}`
}

function plural(days: number) {
  return `${days} ${dayWord(days)}`
}

/** The word that agrees with a count of days, for layouts that set the number apart. */
export function dayWord(days: number): string {
  return pluralForm(days, ['день', 'дня', 'дней'])
}

/**
 * The goal a day is lived towards: the one marked main while it is still open, otherwise the
 * first open goal. A closed goal keeps its flag in the archive but is no longer followed.
 */
export function pickMainGoal(goals: ReadonlyArray<GoalDto>): GoalDto | null {
  const active = goals.filter((goal) => goal.status === 'active')
  return active.find((goal) => goal.isPrimary) ?? active[0] ?? null
}

/** Open goals whose deadline has passed: each needs an answer - extend, close or give up. */
export function overdueGoals(goals: ReadonlyArray<GoalDto>, today: string): GoalDto[] {
  return goals.filter((goal) => goal.status === 'active' && goal.deadline.slice(0, 10) < today)
}

/** "31.12.2026". A deadline is a calendar day, read in UTC the way `describeGoal` counts it. */
export function formatDeadline(deadline: string): string {
  return formatDate(deadline.slice(0, 10))
}

/** How a history row explains a move of the number. */
export function progressReasonLabel(reason: string): string {
  switch (reason) {
    case 'created':
      return 'Цель поставлена'
    case 'manual':
      return 'Записано вручную'
    case 'steps':
      return 'Изменились шаги'
    case 'target':
      return 'Изменена цель'
    case 'mode':
      return 'Сменён способ подсчёта'
    case 'reopened':
      return 'Цель возвращена в работу'
    case 'restored':
      return 'Шаги вернулись из корзины'
    default:
      return 'Изменение'
  }
}

export type StepContext = {
  goal: GoalDto
  stage: GoalDto['stages'][number]
  step: GoalDto['stages'][number]['steps'][number]
}

/**
 * The goal and stage a step belongs to, read from the cached tree. A step of a goal in the
 * trash is not in the tree, so a task pointing at it names no goal (task 11).
 */
export function findStep(goals: ReadonlyArray<GoalDto>, stepId: string | null): StepContext | null {
  if (stepId === null) return null
  for (const goal of goals) {
    for (const stage of goal.stages) {
      const step = stage.steps.find((candidate) => candidate.id === stepId)
      if (step) return { goal, stage, step }
    }
  }
  return null
}

/** Steps still to do in goals in work, for the steps panel of the day (task 16). */
export function openSteps(goals: ReadonlyArray<GoalDto>): StepContext[] {
  return goals
    .filter((goal) => goal.status === 'active')
    .flatMap((goal) =>
      goal.stages.flatMap((stage) =>
        stage.steps
          .filter((step) => step.completedAt === null)
          .map((step) => ({ goal, stage, step })),
      ),
    )
}
