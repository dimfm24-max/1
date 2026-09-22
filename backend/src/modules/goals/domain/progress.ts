/**
 * How far a goal has moved, as a share between 0 and 1.
 *
 * Two goals can carry the same number and mean different things: one counts kilograms the person
 * records, the other counts steps the app can see. Both answer the same question on the day
 * screen, so the arithmetic lives here rather than in either reader.
 */
export function goalCompletionRatio(input: {
  currentValue: number
  targetValue: number
}): number {
  // A target of zero is meaningless as a denominator, and a person who typed it is not asking
  // for an error - they are saying "no number to reach". Report nothing achieved rather than
  // dividing, which would surface as Infinity or NaN in the interface.
  if (!(input.targetValue > 0)) return 0
  const ratio = input.currentValue / input.targetValue
  if (!Number.isFinite(ratio) || ratio < 0) return 0
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
function round3(value: number) {
  return Math.round(value * 1000) / 1000
}

export function daysUntil(deadline: Date, now: Date): number {
  const dayMs = 24 * 60 * 60 * 1000
  // Whole days from the start of today, so "tomorrow" reads as 1 all day rather than sliding
  // from 1 to 0 as the clock passes the deadline's time of day.
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const startOfDeadline = Date.UTC(
    deadline.getUTCFullYear(),
    deadline.getUTCMonth(),
    deadline.getUTCDate(),
  )
  return Math.round((startOfDeadline - startOfToday) / dayMs)
}
