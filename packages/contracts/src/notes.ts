import { z } from 'zod'

/**
 * Notes. Free writing that may hang off a goal or stand alone, because a thought worth keeping
 * does not always know yet which goal it serves.
 */

export const NOTE_TITLE_MAX = 200

export const noteSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  body: z.string(),
  goalId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const notesResponseSchema = z.object({ notes: z.array(noteSchema) }).strict()
export const noteResponseSchema = z.object({ note: noteSchema }).strict()

export const createNoteRequestSchema = z
  .object({
    title: z.union([z.string().trim().min(1).max(NOTE_TITLE_MAX), z.null()]).optional(),
    body: z.string().trim().min(1),
    goalId: z.union([z.uuid(), z.null()]).optional(),
  })
  .strict()

export const updateNoteRequestSchema = z
  .object({
    title: z.union([z.string().trim().min(1).max(NOTE_TITLE_MAX), z.null()]).optional(),
    body: z.string().trim().min(1).optional(),
    goalId: z.union([z.uuid(), z.null()]).optional(),
  })
  .strict()

export const noteIdParamsSchema = z.object({ noteId: z.uuid() }).strict()

export type NoteDto = z.infer<typeof noteSchema>
export type NotesResponse = z.infer<typeof notesResponseSchema>
export type CreateNoteRequest = z.infer<typeof createNoteRequestSchema>
export type UpdateNoteRequest = z.infer<typeof updateNoteRequestSchema>
