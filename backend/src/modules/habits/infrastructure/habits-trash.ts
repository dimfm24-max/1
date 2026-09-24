import type { DbClient } from '../../../db'

/** Habits in the trash (task 11), with every mark kept: a restored streak counts from them. */
export function createHabitsTrashSource(db: DbClient) {
  async function list(userId: string) {
    const habits = await db.habit.findMany({
      where: { userId, deletedAt: { not: null } },
      select: { id: true, title: true, deletedAt: true },
    })
    return habits.map((habit) => ({
      kind: 'habit' as const,
      id: habit.id,
      title: habit.title,
      parentTitle: null,
      day: null,
      deletedAt: habit.deletedAt!,
    }))
  }

  async function restore(userId: string, _kind: 'habit', id: string) {
    const habit = await db.habit.findFirst({
      where: { id, userId, deletedAt: { not: null } },
      select: { id: true, title: true, deletedAt: true },
    })
    if (!habit) return null
    await db.habit.update({ where: { id }, data: { deletedAt: null } })
    return [
      {
        kind: 'habit' as const,
        id: habit.id,
        title: habit.title,
        parentTitle: null,
        day: null,
        deletedAt: habit.deletedAt!,
      },
    ]
  }

  async function purge(userId: string, _kind: 'habit', id: string) {
    const result = await db.habit.deleteMany({ where: { id, userId, deletedAt: { not: null } } })
    return result.count > 0
  }

  async function purgeExpired(before: Date, limit: number) {
    const rows = await db.habit.findMany({
      where: { deletedAt: { lt: before } },
      select: { id: true },
      take: limit,
    })
    if (rows.length === 0) return 0
    const result = await db.habit.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } })
    return result.count
  }

  return { kinds: ['habit'] as const, list, restore, purge, purgeExpired }
}
