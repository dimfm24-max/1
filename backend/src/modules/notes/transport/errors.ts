import { AppError } from '../../../http/errors'
import { NotesFailure } from '../domain/errors'

export function toNotesAppError(error: unknown) {
  if (!(error instanceof NotesFailure)) return error
  return new AppError(404, 'NOT_FOUND', error.message)
}

export async function executeNotes<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toNotesAppError(error)
  }
}
