import type { DbClient } from '../../../db'

/**
 * Tasks in the trash (task 11). A task comes back to its own day; subtasks never left it. The
 * link to a goal step survives, because the step is cleared only when it is purged itself.
 */
export function createDayTrashSource(db: DbClient) {
  async function list(userId: string) {
    const tasks = await db.task.findMany({
      where: { userId, deletedAt: { not: null } },
      select: { id: true, title: true, scheduledOn: true, deletedAt: true },
    })
    return tasks.map((task) => ({
      kind: 'task' as const,
      id: task.id,
      title: task.title,
      parentTitle: null,
      day: task.scheduledOn.toISOString().slice(0, 10),
      deletedAt: task.deletedAt!,
    }))
  }

  async function restore(userId: string, _kind: 'task', id: string) {
    const task = await db.task.findFirst({
      where: { id, userId, deletedAt: { not: null } },
      select: { id: true, title: true, scheduledOn: true, deletedAt: true },
    })
    if (!task) return null
    await db.task.update({ where: { id }, data: { deletedAt: null } })
    return [
      {
        kind: 'task' as const,
        id: task.id,
        title: task.title,
        parentTitle: null,
        day: task.scheduledOn.toISOString().slice(0, 10),
        deletedAt: task.deletedAt!,
      },
    ]
  }

  async function purge(userId: string, _kind: 'task', id: string) {
    const result = await db.task.deleteMany({ where: { id, userId, deletedAt: { not: null } } })
    return result.count > 0
  }

  async function purgeExpired(before: Date, limit: number) {
    const rows = await db.task.findMany({
      where: { deletedAt: { lt: before } },
      select: { id: true },
      take: limit,
    })
    if (rows.length === 0) return 0
    const result = await db.task.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } })
    return result.count
  }

  return { kinds: ['task'] as const, list, restore, purge, purgeExpired }
}
