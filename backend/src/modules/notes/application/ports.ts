import type { CreateNoteRequest, NoteDto, UpdateNoteRequest } from '@dilife/contracts'

export type NotesRepository = {
  list(userId: string, goalId?: string): Promise<NoteDto[]>
  create(userId: string, input: CreateNoteRequest): Promise<NoteDto>
  update(userId: string, noteId: string, input: UpdateNoteRequest): Promise<NoteDto>
  /** Sends the note to the trash. */
  remove(userId: string, noteId: string, now: Date): Promise<NoteDto[]>
}
