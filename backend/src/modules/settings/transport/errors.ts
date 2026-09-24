import { AppError } from '../../../http/errors'
import { SettingsFailure } from '../domain/errors'

export function toSettingsAppError(error: unknown) {
  if (!(error instanceof SettingsFailure)) return error
  return new AppError(400, 'VALIDATION_ERROR', error.message)
}

export async function executeSettings<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toSettingsAppError(error)
  }
}
