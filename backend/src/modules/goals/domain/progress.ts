/**
 * How far a goal has moved, as a share between 0 and 1. The one formula every screen shows:
 * the server sends the share, clients only draw it.
 *
 * A manual goal may carry a start ("сколько сейчас" when it was set). The bar then runs from the
 * start to the target in either direction: "60 килограммов" from 80 reads 0 % at 80, 50 % at 70
 * and 100 % at 60. Without a start the count runs up from zero.
 */
export function goalCompletionRatio(input: {
  currentValue: number
  targetValue: number
  initialValue?: number | null
}): number {
  const start = input.initialValue ?? null
  if (start === null) {
    // A target of zero is meaningless as a denominator. Report nothing achieved rather than
    // dividing, which would surface as Infinity or NaN in the interface.
    if (!(input.targetValue > 0)) return 0
    return clampRatio(input.currentValue / input.targetValue)
  }
  const span = input.targetValue - start
  if (span === 0) return 0
  return clampRatio((input.currentValue - start) / span)
}

/** The share for any goal: counted steps for an automatic one, the formula above otherwise. */
export function goalRatio(goal: {
  progressMode: 'manual' | 'automatic'
  currentValue: number
  targetValue: number
  initialValue: number | null
}): number {
  return goalCompletionRatio({
    currentValue: goal.currentValue,
    targetValue: goal.targetValue,
    initialValue: goal.progressMode === 'manual' ? goal.initialValue : null,
  })
}

function clampRatio(ratio: number) {
  // `<= 0` also turns -0 (80 - 80 over a falling span) into a plain 0.
  if (!Number.isFinite(ratio) || ratio <= 0) return 0
  // Overshooting is normal - 45 km against a 42 km target - but the bar stops at full.
  return Math.min(ratio, 1)
}

/**
 * The value an automatic goal carries: how many of its steps are done.
 *
 * Steps are counted, not weighted by their estimates. A person breaking work into steps means
 * them to be comparable units of progress; letting a long step count for more would make the
 * bar jump for reasons the tree does not show.
 */
export function automaticProgressValue(input: {
  completedSteps: number
  totalSteps: number
  targetValue: number
}): number {
  if (input.totalSteps <= 0) return 0
  const ratio = Math.min(input.completedSteps / input.totalSteps, 1)
  return round3(ratio * input.targetValue)
}

/** Three decimals, matching the column, so a stored value reads back as it was computed. */
export function round3(value: number) {
  return Math.round(value * 1000) / 1000
}

/** Whole days from `today` to `deadline`, both `YYYY-MM-DD`. Negative once the deadline passed. */
export function daysUntil(deadline: string, today: string): number {
  const dayMs = 24 * 60 * 60 * 1000
  return Math.round(
    (Date.parse(`${deadline}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / dayMs,
  )
}
