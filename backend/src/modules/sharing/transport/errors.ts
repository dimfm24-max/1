import { AppError } from '../../../http/errors'
import { SharingFailure } from '../domain/errors'

export function toSharingAppError(error: unknown) {
  if (!(error instanceof SharingFailure)) return error
  return new AppError(404, 'NOT_FOUND', error.message)
}

export async function executeSharing<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toSharingAppError(error)
  }
}
