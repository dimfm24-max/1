export type GoalsFailureKind =
  /** No such row for this owner. Another person's row is reported the same way, on purpose. */
  | 'not_found'
  /** A goal cannot exist before the life goal it belongs to. */
  | 'life_goal_required'
  /** Progress is recorded by hand only while the goal is in manual mode. */
  | 'progress_not_manual'
  /** A closed goal is read-only: reopening is a separate, deliberate act. */
  | 'goal_closed'

export class GoalsFailure extends Error {
  constructor(
    readonly kind: GoalsFailureKind,
    message: string,
  ) {
    super(message)
    this.name = 'GoalsFailure'
  }
}
