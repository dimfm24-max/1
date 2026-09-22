import { AppError } from '../../../http/errors'
import { HabitsFailure } from '../domain/errors'

export function toHabitsAppError(error: unknown) {
  if (!(error instanceof HabitsFailure)) return error
  return new AppError(404, 'NOT_FOUND', error.message)
}

export async function executeHabits<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toHabitsAppError(error)
  }
}
