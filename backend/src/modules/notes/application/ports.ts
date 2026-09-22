import type { CreateNoteRequest, NoteDto, UpdateNoteRequest } from '@dilife/contracts'

export type NotesRepository = {
  list(userId: string, goalId?: string): Promise<NoteDto[]>
  create(userId: string, input: CreateNoteRequest): Promise<NoteDto>
  update(userId: string, noteId: string, input: UpdateNoteRequest): Promise<NoteDto>
  remove(userId: string, noteId: string): Promise<NoteDto[]>
}
