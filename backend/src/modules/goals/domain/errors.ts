export type GoalsFailureKind =
  /** No such row for this owner. Another person's row is reported the same way, on purpose. */
  | 'not_found'
  /** A goal cannot exist before the life goal it belongs to. */
  | 'life_goal_required'
  /** Progress is recorded by hand only while the goal is in manual mode. */
  | 'progress_not_manual'
  /** A closed goal is read-only: reopening is a separate, deliberate act. */
  | 'goal_closed'
  /** A deadline earlier than the person's today. */
  | 'deadline_in_past'
  /** A request the contract lets through but the stored goal makes wrong: a bad reorder, a target equal to the start. */
  | 'invalid_input'

export class GoalsFailure extends Error {
  constructor(
    readonly kind: GoalsFailureKind,
    message: string,
  ) {
    super(message)
    this.name = 'GoalsFailure'
  }
}
