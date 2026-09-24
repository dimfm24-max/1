import type { CreateNoteRequest, NoteDto, UpdateNoteRequest } from '@dilife/contracts'

import type { DbClient } from '../../../db'
import type { NotesRepository } from '../application/ports'
import { NotesFailure } from '../domain/errors'

const noteSelect = {
  id: true,
  title: true,
  body: true,
  goalId: true,
  createdAt: true,
  updatedAt: true,
} as const

type NoteRow = {
  id: string
  title: string | null
  body: string
  goalId: string | null
  createdAt: Date
  updatedAt: Date
}

export function createPrismaNotesRepository(db: DbClient): NotesRepository {
  /** A goal id is accepted only when it belongs to this person; anything else is refused. */
  async function ownedGoalId(userId: string, goalId: string | null) {
    if (goalId === null) return null
    const goal = await db.goal.findFirst({
      where: { id: goalId, userId, deletedAt: null },
      select: { id: true },
    })
    if (!goal) throw new NotesFailure('not_found', 'Goal not found')
    return goal.id
  }

  async function list(userId: string, goalId?: string) {
    const notes = await db.note.findMany({
      where: { userId, deletedAt: null, ...(goalId === undefined ? {} : { goalId }) },
      // Most recently touched first: the notes screen is a stack of what is currently on a
      // person's mind, not an archive in the order things were written.
      orderBy: { updatedAt: 'desc' },
      select: noteSelect,
    })
    return notes.map((note) => toDto(note as NoteRow))
  }

  return {
    list,

    async create(userId, input: CreateNoteRequest) {
      const created = await db.note.create({
        data: {
          userId,
          title: input.title ?? null,
          body: input.body,
          goalId: await ownedGoalId(userId, input.goalId ?? null),
        },
        select: noteSelect,
      })
      return toDto(created as NoteRow)
    },

    async update(userId, noteId, input: UpdateNoteRequest) {
      const note = await db.note.findFirst({
        where: { id: noteId, userId, deletedAt: null },
        select: { id: true },
      })
      if (!note) throw new NotesFailure('not_found', 'Note not found')

      const updated = await db.note.update({
        where: { id: noteId },
        data: {
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.body === undefined ? {} : { body: input.body }),
          ...(input.goalId === undefined
            ? {}
            : { goalId: await ownedGoalId(userId, input.goalId) }),
        },
        select: noteSelect,
      })
      return toDto(updated as NoteRow)
    },

    async remove(userId, noteId, now) {
      const deleted = await db.note.updateMany({
        where: { id: noteId, userId, deletedAt: null },
        data: { deletedAt: now },
      })
      if (deleted.count === 0) throw new NotesFailure('not_found', 'Note not found')
      return list(userId)
    },
  }
}

function toDto(row: NoteRow): NoteDto {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    goalId: row.goalId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
