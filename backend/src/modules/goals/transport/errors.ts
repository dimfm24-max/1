import { AppError } from '../../../http/errors'
import { GoalsFailure } from '../domain/errors'

/**
 * Each failure maps to a status and a code the client can act on: create the life goal first,
 * switch the goal to manual, or reopen it. A single 409 would leave the interface guessing which
 * of the three it is.
 */
export function toGoalsAppError(error: unknown) {
  if (!(error instanceof GoalsFailure)) return error

  if (error.kind === 'not_found') {
    return new AppError(404, 'NOT_FOUND', error.message)
  }
  if (error.kind === 'life_goal_required') {
    return new AppError(409, 'LIFE_GOAL_REQUIRED', error.message)
  }
  if (error.kind === 'progress_not_manual') {
    return new AppError(409, 'GOAL_PROGRESS_NOT_MANUAL', error.message)
  }
  return new AppError(409, 'GOAL_CLOSED', error.message)
}

export async function executeGoals<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toGoalsAppError(error)
  }
}
