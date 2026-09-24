import type { DbClient } from '../../../db'
import { recountGoal } from './goals-repository'

/** One item of the trash as this module describes it; the trash module adds the purge date. */
export type GoalsTrashEntry = {
  kind: 'goal' | 'stage' | 'step'
  id: string
  title: string
  parentTitle: string | null
  day: null
  deletedAt: Date
}

type Kind = GoalsTrashEntry['kind']

/**
 * Goals, stages and steps in the trash (task 11). Deleting a goal marks only the goal: its stages
 * and steps disappear with it and come back with it. A stage or step deleted on its own carries its
 * own mark, and restoring it brings back a parent that is also in the trash.
 */
export function createGoalsTrashSource(db: DbClient) {
  async function list(userId: string): Promise<GoalsTrashEntry[]> {
    const [goals, stages, steps] = await Promise.all([
      db.goal.findMany({
        where: { userId, deletedAt: { not: null } },
        select: { id: true, title: true, deletedAt: true },
      }),
      db.goalStage.findMany({
        where: { userId, deletedAt: { not: null } },
        select: { id: true, title: true, deletedAt: true, goal: { select: { title: true } } },
      }),
      db.goalStep.findMany({
        where: { userId, deletedAt: { not: null } },
        select: {
          id: true,
          title: true,
          deletedAt: true,
          stage: { select: { goal: { select: { title: true } } } },
        },
      }),
    ])
    return [
      ...goals.map((goal) => entry('goal', goal.id, goal.title, null, goal.deletedAt!)),
      ...stages.map((stage) =>
        entry('stage', stage.id, stage.title, stage.goal.title, stage.deletedAt!),
      ),
      ...steps.map((step) =>
        entry('step', step.id, step.title, step.stage.goal.title, step.deletedAt!),
      ),
    ]
  }

  async function restore(userId: string, kind: Kind, id: string): Promise<GoalsTrashEntry[] | null> {
    return db.$transaction(async (tx) => {
      const restored: GoalsTrashEntry[] = []
      let goalId: string
      let stageId: string | null = null

      if (kind === 'goal') {
        goalId = id
      } else if (kind === 'stage') {
        const stage = await tx.goalStage.findFirst({
          where: { id, userId },
          select: { goalId: true },
        })
        if (!stage) return null
        goalId = stage.goalId
        stageId = id
      } else {
        const step = await tx.goalStep.findFirst({
          where: { id, userId },
          select: { stageId: true, stage: { select: { goalId: true } } },
        })
        if (!step) return null
        goalId = step.stage.goalId
        stageId = step.stageId
      }

      const goal = await tx.goal.findFirst({
        where: { id: goalId, userId },
        select: { id: true, title: true, deletedAt: true },
      })
      if (!goal) return null
      if (goal.deletedAt) {
        await tx.goal.update({ where: { id: goal.id }, data: { deletedAt: null } })
        restored.push(entry('goal', goal.id, goal.title, null, goal.deletedAt))
      } else if (kind === 'goal') {
        return null
      }

      if (stageId) {
        const stage = await tx.goalStage.findUniqueOrThrow({
          where: { id: stageId },
          select: { id: true, title: true, deletedAt: true },
        })
        if (stage.deletedAt) {
          await tx.goalStage.update({ where: { id: stage.id }, data: { deletedAt: null } })
          restored.push(entry('stage', stage.id, stage.title, goal.title, stage.deletedAt))
        } else if (kind === 'stage') {
          return null
        }
      }

      if (kind === 'step') {
        const step = await tx.goalStep.findUniqueOrThrow({
          where: { id },
          select: { id: true, title: true, deletedAt: true },
        })
        if (!step.deletedAt) return null
        await tx.goalStep.update({ where: { id }, data: { deletedAt: null } })
        restored.push(entry('step', step.id, step.title, goal.title, step.deletedAt))
      }

      // Steps back in the tree move an automatic goal; the history says why.
      if (kind !== 'goal') await recountGoal(tx, userId, goalId, 'restored')
      return restored
    })
  }

  /** Gone for good. Tasks that pointed at a purged step keep their place and lose the link. */
  async function purge(userId: string, kind: Kind, id: string): Promise<boolean> {
    const where = { id, userId, deletedAt: { not: null } }
    const result =
      kind === 'goal'
        ? await db.goal.deleteMany({ where })
        : kind === 'stage'
          ? await db.goalStage.deleteMany({ where })
          : await db.goalStep.deleteMany({ where })
    return result.count > 0
  }

  async function purgeExpired(before: Date, limit: number): Promise<number> {
    let removed = 0
    for (const table of ['goalStep', 'goalStage', 'goal'] as const) {
      const delegate = db[table] as unknown as {
        findMany(args: unknown): Promise<Array<{ id: string }>>
        deleteMany(args: unknown): Promise<{ count: number }>
      }
      const rows = await delegate.findMany({
        where: { deletedAt: { lt: before } },
        select: { id: true },
        take: Math.max(limit - removed, 0),
      })
      if (rows.length === 0) continue
      const result = await delegate.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } })
      removed += result.count
    }
    return removed
  }

  return { kinds: ['goal', 'stage', 'step'] as const, list, restore, purge, purgeExpired }
}

function entry(
  kind: Kind,
  id: string,
  title: string,
  parentTitle: string | null,
  deletedAt: Date,
): GoalsTrashEntry {
  return { kind, id, title, parentTitle, day: null, deletedAt }
}
