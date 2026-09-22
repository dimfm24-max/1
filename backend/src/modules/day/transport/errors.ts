import { AppError } from '../../../http/errors'
import { DayFailure } from '../domain/errors'

export function toDayAppError(error: unknown) {
  if (!(error instanceof DayFailure)) return error

  if (error.kind === 'not_found') {
    return new AppError(404, 'NOT_FOUND', error.message)
  }
  return new AppError(409, 'TASK_ALREADY_RESOLVED', error.message)
}

export async function executeDay<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toDayAppError(error)
  }
}
