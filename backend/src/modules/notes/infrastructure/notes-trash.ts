import type { DbClient } from '../../../db'

/** Notes in the trash (task 11). A restored note keeps its goal link; the goal may be gone. */
export function createNotesTrashSource(db: DbClient) {
  function title(note: { title: string | null; body: string }) {
    return note.title ?? note.body.slice(0, 80)
  }

  async function list(userId: string) {
    const notes = await db.note.findMany({
      where: { userId, deletedAt: { not: null } },
      select: { id: true, title: true, body: true, deletedAt: true },
    })
    return notes.map((note) => ({
      kind: 'note' as const,
      id: note.id,
      title: title(note),
      parentTitle: null,
      day: null,
      deletedAt: note.deletedAt!,
    }))
  }

  async function restore(userId: string, _kind: 'note', id: string) {
    const note = await db.note.findFirst({
      where: { id, userId, deletedAt: { not: null } },
      select: { id: true, title: true, body: true, deletedAt: true },
    })
    if (!note) return null
    await db.note.update({ where: { id }, data: { deletedAt: null } })
    return [
      {
        kind: 'note' as const,
        id: note.id,
        title: title(note),
        parentTitle: null,
        day: null,
        deletedAt: note.deletedAt!,
      },
    ]
  }

  async function purge(userId: string, _kind: 'note', id: string) {
    const result = await db.note.deleteMany({ where: { id, userId, deletedAt: { not: null } } })
    return result.count > 0
  }

  async function purgeExpired(before: Date, limit: number) {
    const rows = await db.note.findMany({
      where: { deletedAt: { lt: before } },
      select: { id: true },
      take: limit,
    })
    if (rows.length === 0) return 0
    const result = await db.note.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } })
    return result.count
  }

  return { kinds: ['note'] as const, list, restore, purge, purgeExpired }
}
