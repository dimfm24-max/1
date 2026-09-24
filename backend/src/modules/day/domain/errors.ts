export type DayFailureKind =
  /** No such row for this owner. Another person's row is reported the same way, on purpose. */
  | 'not_found'
  /** A task already closed cannot be closed again with a different answer. */
  | 'task_already_resolved'
  /** A goal step is planned by hand and never repeats (owner's decision on task 18). */
  | 'repeat_with_step'

export class DayFailure extends Error {
  constructor(
    readonly kind: DayFailureKind,
    message: string,
  ) {
    super(message)
    this.name = 'DayFailure'
  }
}
