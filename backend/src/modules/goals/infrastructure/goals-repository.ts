import type {
  CloseGoalRequest,
  CreateGoalRequest,
  CreateStageRequest,
  CreateStepRequest,
  GoalDto,
  GoalTreeResponse,
  LifeGoalDto,
  UpdateGoalRequest,
  UpdateStageRequest,
  UpdateStepRequest,
} from '@dilife/contracts'

import type { DbClient } from '../../../db'
import type { GoalsRepository } from '../application/ports'
import { GoalsFailure } from '../domain/errors'
import { automaticProgressValue } from '../domain/progress'

/**
 * One shape for every goal read, so a goal returned by a step edit is the same object the tree
 * returned. The client re-renders a goal from any response without a second request.
 */
const goalSelect = {
  id: true,
  title: true,
  description: true,
  deadline: true,
  measureUnit: true,
  targetValue: true,
  currentValue: true,
  progressMode: true,
  status: true,
  outcomeNote: true,
  position: true,
  completedAt: true,
  createdAt: true,
  lifeGoalId: true,
  stages: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      title: true,
      position: true,
      steps: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          estimatedMinutes: true,
          completedAt: true,
          position: true,
        },
      },
    },
  },
} as const

type GoalRow = {
  id: string
  title: string
  description: string | null
  deadline: Date
  measureUnit: string
  targetValue: unknown
  currentValue: unknown
  progressMode: 'manual' | 'automatic'
  status: 'active' | 'completed' | 'abandoned'
  outcomeNote: string | null
  position: number
  completedAt: Date | null
  createdAt: Date
  lifeGoalId: string
  stages: Array<{
    id: string
    title: string
    position: number
    steps: Array<{
      id: string
      title: string
      estimatedMinutes: number | null
      completedAt: Date | null
      position: number
    }>
  }>
}

export function createPrismaGoalsRepository(db: DbClient): GoalsRepository {
  async function goalDto(row: GoalRow, primaryGoalId: string | null): Promise<GoalDto> {
    return toGoalDto(row, primaryGoalId)
  }

  async function primaryGoalIdFor(userId: string) {
    const lifeGoal = await db.lifeGoal.findUnique({
      where: { userId },
      select: { primaryGoalId: true },
    })
    return lifeGoal?.primaryGoalId ?? null
  }

  async function readGoalOrFail(userId: string, goalId: string) {
    const goal = await db.goal.findFirst({ where: { id: goalId, userId }, select: goalSelect })
    if (!goal) throw new GoalsFailure('not_found', 'Goal not found')
    return goal as GoalRow
  }

  /**
   * The goal as it now stands, after a write that may have changed its steps. Automatic goals
   * recompute their value here rather than in every step handler: one place decides what the
   * number means, and a manual goal is never overwritten by it.
   */
  async function refreshGoal(userId: string, goalId: string): Promise<GoalDto> {
    const goal = await readGoalOrFail(userId, goalId)
    if (goal.progressMode === 'automatic') {
      const steps = goal.stages.flatMap((stage) => stage.steps)
      const value = automaticProgressValue({
        completedSteps: steps.filter((step) => step.completedAt !== null).length,
        totalSteps: steps.length,
        targetValue: toNumber(goal.targetValue),
      })
      if (value !== toNumber(goal.currentValue)) {
        const updated = await db.goal.update({
          where: { id: goalId },
          data: { currentValue: value },
          select: goalSelect,
        })
        return goalDto(updated as GoalRow, await primaryGoalIdFor(userId))
      }
    }
    return goalDto(goal, await primaryGoalIdFor(userId))
  }

  async function stageOwnedOrFail(userId: string, stageId: string) {
    const stage = await db.goalStage.findFirst({
      where: { id: stageId, userId },
      select: { id: true, goalId: true },
    })
    if (!stage) throw new GoalsFailure('not_found', 'Stage not found')
    return stage
  }

  async function stepOwnedOrFail(userId: string, stepId: string) {
    const step = await db.goalStep.findFirst({
      where: { id: stepId, userId },
      select: { id: true, completedAt: true, stage: { select: { goalId: true } } },
    })
    if (!step) throw new GoalsFailure('not_found', 'Step not found')
    return step
  }

  async function lifeGoalOrFail(userId: string) {
    const lifeGoal = await db.lifeGoal.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!lifeGoal) {
      throw new GoalsFailure(
        'life_goal_required',
        'Create the life goal before adding goals to it',
      )
    }
    return lifeGoal
  }

  async function assertGoalOpen(userId: string, goalId: string) {
    const goal = await db.goal.findFirst({
      where: { id: goalId, userId },
      select: { status: true },
    })
    if (!goal) throw new GoalsFailure('not_found', 'Goal not found')
    if (goal.status !== 'active') {
      throw new GoalsFailure('goal_closed', 'Reopen the goal before changing it')
    }
  }

  async function nextPosition(
    table: 'goal' | 'goalStage' | 'goalStep',
    where: Record<string, string>,
  ) {
    // Sparse positions are fine: they only order rows. Reusing a freed number would let a
    // delete silently reorder a sibling, which a person would read as the app moving their work.
    const last = await (db[table] as {
      findFirst(args: unknown): Promise<{ position: number } | null>
    }).findFirst({
      where,
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    return (last?.position ?? -1) + 1
  }

  return {
    async readTree(userId) {
      const lifeGoal = await db.lifeGoal.findUnique({
        where: { userId },
        select: { id: true, title: true, createdAt: true, primaryGoalId: true },
      })
      const goals = await db.goal.findMany({
        where: { userId },
        orderBy: [{ status: 'asc' }, { position: 'asc' }],
        select: goalSelect,
      })
      return {
        lifeGoal: lifeGoal
          ? {
              id: lifeGoal.id,
              title: lifeGoal.title,
              createdAt: lifeGoal.createdAt.toISOString(),
            }
          : null,
        goals: goals.map((goal) => toGoalDto(goal as GoalRow, lifeGoal?.primaryGoalId ?? null)),
      } satisfies GoalTreeResponse
    },

    async upsertLifeGoal(userId, title) {
      const lifeGoal = await db.lifeGoal.upsert({
        where: { userId },
        create: { userId, title },
        update: { title },
        select: { id: true, title: true, createdAt: true },
      })
      return {
        id: lifeGoal.id,
        title: lifeGoal.title,
        createdAt: lifeGoal.createdAt.toISOString(),
      } satisfies LifeGoalDto
    },

    async createGoal(userId, input: CreateGoalRequest) {
      const lifeGoal = await lifeGoalOrFail(userId)
      const created = await db.goal.create({
        data: {
          lifeGoalId: lifeGoal.id,
          userId,
          title: input.title,
          description: input.description ?? null,
          deadline: new Date(input.deadline),
          measureUnit: input.measureUnit,
          targetValue: input.targetValue,
          progressMode: input.progressMode,
          position: await nextPosition('goal', { lifeGoalId: lifeGoal.id }),
        },
        select: goalSelect,
      })
      // The first goal becomes the one the day screen shows: a person who named one goal did not
      // also mean to choose it, and an empty day screen would be the app's fault, not theirs.
      const primaryGoalId = await primaryGoalIdFor(userId)
      if (primaryGoalId === null) {
        await db.lifeGoal.update({
          where: { userId },
          data: { primaryGoalId: created.id },
        })
        return toGoalDto(created as GoalRow, created.id)
      }
      return toGoalDto(created as GoalRow, primaryGoalId)
    },

    async updateGoal(userId, goalId, input: UpdateGoalRequest) {
      await assertGoalOpen(userId, goalId)
      await db.goal.update({
        where: { id: goalId },
        data: {
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.deadline === undefined ? {} : { deadline: new Date(input.deadline) }),
          ...(input.measureUnit === undefined ? {} : { measureUnit: input.measureUnit }),
          ...(input.targetValue === undefined ? {} : { targetValue: input.targetValue }),
          ...(input.progressMode === undefined ? {} : { progressMode: input.progressMode }),
        },
      })
      return refreshGoal(userId, goalId)
    },

    async recordProgress(userId, goalId, currentValue) {
      const goal = await db.goal.findFirst({
        where: { id: goalId, userId },
        select: { progressMode: true, status: true },
      })
      if (!goal) throw new GoalsFailure('not_found', 'Goal not found')
      if (goal.status !== 'active') {
        throw new GoalsFailure('goal_closed', 'Reopen the goal before recording progress')
      }
      if (goal.progressMode !== 'manual') {
        throw new GoalsFailure(
          'progress_not_manual',
          'This goal counts its completed steps; switch it to manual to record a value',
        )
      }
      const updated = await db.goal.update({
        where: { id: goalId },
        data: { currentValue },
        select: goalSelect,
      })
      return toGoalDto(updated as GoalRow, await primaryGoalIdFor(userId))
    },

    async closeGoal(userId, goalId, input: CloseGoalRequest, now) {
      await assertGoalOpen(userId, goalId)
      const updated = await db.goal.update({
        where: { id: goalId },
        data: {
          status: input.status,
          outcomeNote: input.outcomeNote ?? null,
          completedAt: now,
        },
        select: goalSelect,
      })
      return toGoalDto(updated as GoalRow, await primaryGoalIdFor(userId))
    },

    async reopenGoal(userId, goalId, deadline) {
      const goal = await db.goal.findFirst({
        where: { id: goalId, userId },
        select: { status: true },
      })
      if (!goal) throw new GoalsFailure('not_found', 'Goal not found')
      const updated = await db.goal.update({
        where: { id: goalId },
        // The outcome note is kept: it belongs to the attempt that ended, and a goal picked up
        // again is the same goal, now with a record of how it went the first time.
        data: { status: 'active', completedAt: null, deadline },
        select: goalSelect,
      })
      return toGoalDto(updated as GoalRow, await primaryGoalIdFor(userId))
    },

    async setPrimaryGoal(userId, goalId) {
      const goal = await readGoalOrFail(userId, goalId)
      await db.lifeGoal.update({ where: { userId }, data: { primaryGoalId: goalId } })
      return toGoalDto(goal, goalId)
    },

    async deleteGoal(userId, goalId) {
      const deleted = await db.goal.deleteMany({ where: { id: goalId, userId } })
      if (deleted.count === 0) throw new GoalsFailure('not_found', 'Goal not found')
    },

    async createStage(userId, goalId, input: CreateStageRequest) {
      await assertGoalOpen(userId, goalId)
      await db.goalStage.create({
        data: {
          goalId,
          userId,
          title: input.title,
          position: await nextPosition('goalStage', { goalId }),
        },
      })
      return refreshGoal(userId, goalId)
    },

    async updateStage(userId, stageId, input: UpdateStageRequest) {
      const stage = await stageOwnedOrFail(userId, stageId)
      await assertGoalOpen(userId, stage.goalId)
      await db.goalStage.update({ where: { id: stageId }, data: { title: input.title } })
      return refreshGoal(userId, stage.goalId)
    },

    async deleteStage(userId, stageId) {
      const stage = await stageOwnedOrFail(userId, stageId)
      await assertGoalOpen(userId, stage.goalId)
      await db.goalStage.delete({ where: { id: stageId } })
      return refreshGoal(userId, stage.goalId)
    },

    async createStep(userId, stageId, input: CreateStepRequest) {
      const stage = await stageOwnedOrFail(userId, stageId)
      await assertGoalOpen(userId, stage.goalId)
      await db.goalStep.create({
        data: {
          stageId,
          userId,
          title: input.title,
          estimatedMinutes: input.estimatedMinutes ?? null,
          position: await nextPosition('goalStep', { stageId }),
        },
      })
      return refreshGoal(userId, stage.goalId)
    },

    async updateStep(userId, stepId, input: UpdateStepRequest, now) {
      const step = await stepOwnedOrFail(userId, stepId)
      await assertGoalOpen(userId, step.stage.goalId)
      await db.goalStep.update({
        where: { id: stepId },
        data: {
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.estimatedMinutes === undefined
            ? {}
            : { estimatedMinutes: input.estimatedMinutes }),
          // Re-completing an already completed step keeps its original moment: the day it was
          // done is a fact, and a stray tap must not rewrite it.
          ...(input.isCompleted === undefined
            ? {}
            : { completedAt: input.isCompleted ? (step.completedAt ?? now) : null }),
        },
      })
      return refreshGoal(userId, step.stage.goalId)
    },

    async deleteStep(userId, stepId) {
      const step = await stepOwnedOrFail(userId, stepId)
      await assertGoalOpen(userId, step.stage.goalId)
      await db.goalStep.delete({ where: { id: stepId } })
      return refreshGoal(userId, step.stage.goalId)
    },
  }
}

function toGoalDto(row: GoalRow, primaryGoalId: string | null): GoalDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    deadline: row.deadline.toISOString(),
    measureUnit: row.measureUnit,
    targetValue: toNumber(row.targetValue),
    currentValue: toNumber(row.currentValue),
    progressMode: row.progressMode,
    status: row.status,
    isPrimary: row.id === primaryGoalId,
    outcomeNote: row.outcomeNote,
    position: row.position,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    stages: row.stages.map((stage) => ({
      id: stage.id,
      title: stage.title,
      position: stage.position,
      steps: stage.steps.map((step) => ({
        id: step.id,
        title: step.title,
        estimatedMinutes: step.estimatedMinutes,
        completedAt: step.completedAt?.toISOString() ?? null,
        position: step.position,
      })),
    })),
  }
}

/** Prisma returns Decimal; the contract carries a plain number a client can render. */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  return Number((value as { toString(): string }).toString())
}
