import {
  DEFAULT_DEADLINE_WARNING_DAYS,
  goalTargetProblem,
  type GoalDto,
  type GoalProgressMode,
} from '@dilife/contracts'

/** The goal form as typed: numbers stay text until they are read, so a half-typed "1," is kept. */
export type GoalDraft = {
  title: string
  description: string
  deadline: string
  measureUnit: string
  progressMode: GoalProgressMode
  initialValue: string
  targetValue: string
  deadlineWarningDays: string
}

export function emptyGoalDraft(): GoalDraft {
  return {
    title: '',
    description: '',
    deadline: '',
    measureUnit: '',
    // Automatic by default: a completed step moves the goal (owner's decision on task 07).
    progressMode: 'automatic',
    initialValue: '',
    targetValue: '',
    deadlineWarningDays: String(DEFAULT_DEADLINE_WARNING_DAYS),
  }
}

export function draftFromGoal(goal: GoalDto): GoalDraft {
  return {
    title: goal.title,
    description: goal.description ?? '',
    deadline: goal.deadline.slice(0, 10),
    measureUnit: goal.measureUnit,
    progressMode: goal.progressMode,
    initialValue:
      goal.initialValue === null || goal.initialValue === undefined ? '' : String(goal.initialValue),
    targetValue: String(goal.targetValue),
    deadlineWarningDays: String(goal.deadlineWarningDays ?? DEFAULT_DEADLINE_WARNING_DAYS),
  }
}

export type ParsedGoalDraft = {
  title: string
  description: string | null
  deadline: string
  measureUnit: string
  progressMode: GoalProgressMode
  initialValue: number | null
  targetValue: number
  deadlineWarningDays: number
}

export type GoalDraftErrors = Partial<Record<keyof GoalDraft, string>>

function readNumber(text: string): number | null {
  const normalized = text.trim().replace(',', '.').replace(/\s/g, '')
  if (normalized === '') return null
  const value = Number(normalized)
  return Number.isFinite(value) && value >= 0 ? value : Number.NaN
}

/** Checks a draft the way the server will, so the form can say what is wrong before sending. */
export function parseGoalDraft(
  draft: GoalDraft,
  today: string,
  options: { deadlineUnchanged?: string } = {},
): { goal: ParsedGoalDraft } | { errors: GoalDraftErrors } {
  const errors: GoalDraftErrors = {}
  const title = draft.title.trim()
  if (title === '') errors.title = 'Назови цель'
  if (title.length > 200) errors.title = 'Название — не длиннее 200 знаков'
  if (draft.deadline === '') errors.deadline = 'Выбери срок'
  else if (draft.deadline < today && draft.deadline !== options.deadlineUnchanged) {
    errors.deadline = 'Срок не может быть в прошлом'
  }
  const measureUnit = draft.measureUnit.trim()
  if (measureUnit === '') errors.measureUnit = 'Напиши, в чём измеряешь'
  const targetValue = readNumber(draft.targetValue)
  if (targetValue === null || Number.isNaN(targetValue)) errors.targetValue = 'Напиши число'
  const initialValue =
    draft.progressMode === 'manual' ? readNumber(draft.initialValue) : null
  if (initialValue !== null && Number.isNaN(initialValue)) errors.initialValue = 'Напиши число'
  const warning = readNumber(draft.deadlineWarningDays)
  if (warning === null || Number.isNaN(warning) || !Number.isInteger(warning) || warning > 365) {
    errors.deadlineWarningDays = 'Целое число дней от 0 до 365'
  }
  if (errors.targetValue === undefined && errors.initialValue === undefined) {
    const problem = goalTargetProblem({
      targetValue: targetValue ?? 0,
      initialValue,
      progressMode: draft.progressMode,
    })
    if (problem) errors.targetValue = problem
  }
  if (Object.keys(errors).length > 0) return { errors }
  return {
    goal: {
      title,
      description: draft.description.trim() === '' ? null : draft.description.trim(),
      deadline: draft.deadline,
      measureUnit,
      progressMode: draft.progressMode,
      initialValue,
      targetValue: targetValue ?? 0,
      deadlineWarningDays: warning ?? DEFAULT_DEADLINE_WARNING_DAYS,
    },
  }
}
