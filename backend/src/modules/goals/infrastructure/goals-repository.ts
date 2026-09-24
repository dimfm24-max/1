import type {
  CloseGoalRequest,
  CreateGoalRequest,
  CreateStageRequest,
  CreateStepRequest,
  GoalDto,
  GoalProgressEntryDto,
  GoalTreeResponse,
  LifeGoalDto,
  UpdateGoalRequest,
  UpdateStageRequest,
  UpdateStepRequest,
} from '@dilife/contracts'

import type { DbClient } from '../../../db'
import { Prisma } from '../../../generated/prisma/client'
import type { GoalsRepository } from '../application/ports'
import { GoalsFailure } from '../domain/errors'
import { automaticProgressValue, goalRatio } from '../domain/progress'

type Tx = Prisma.TransactionClient

/**
 * A deadline is a `date` column. It comes back as a Date at UTC midnight, so both directions go
 * through these helpers rather than the local time zone, which would shift it a day.
 */
function toDayDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`)
}

function fromDayDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

/** Rows in the trash, and rows under a parent in the trash, are not part of the tree. */
const liveStages = { deletedAt: null } as const
const liveSteps = { deletedAt: null } as const

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
  initialValue: true,
  deadlineWarningDays: true,
  progressMode: true,
  status: true,
  outcomeNote: true,
  position: true,
  completedAt: true,
  createdAt: true,
  lifeGoalId: true,
  stages: {
    where: liveStages,
    orderBy: { position: 'asc' },
    select: {
      id: true,
      title: true,
      description: true,
      position: true,
      steps: {
        where: liveSteps,
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
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
  initialValue: unknown
  deadlineWarningDays: number
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
    description: string | null
    position: number
    steps: Array<{
      id: string
      title: string
      description: string | null
      estimatedMinutes: number | null
      completedAt: Date | null
      position: number
    }>
  }>
}

export type ProgressReason =
  | 'created'
  | 'manual'
  | 'steps'
  | 'target'
  | 'mode'
  | 'reopened'
  | 'restored'

async function readGoal(client: Tx | DbClient, userId: string, goalId: string) {
  const goal = await client.goal.findFirst({
    where: { id: goalId, userId, deletedAt: null },
    select: goalSelect,
  })
  if (!goal) throw new GoalsFailure('not_found', 'Goal not found')
  return goal as GoalRow
}


/**
 * Brings the goal's number up to date and writes a history row when the number or its share
 * moved. An automatic goal recounts its live steps; a manual one keeps the person's value.
 */
export async function recountGoal(tx: Tx, userId: string, goalId: string, reason: ProgressReason) {
  const goal = await readGoal(tx, userId, goalId)
  let currentValue = toNumber(goal.currentValue)
  const targetValue = toNumber(goal.targetValue)
  if (goal.progressMode === 'automatic' && goal.status === 'active') {
    const steps = goal.stages.flatMap((stage) => stage.steps)
    const value = automaticProgressValue({
      completedSteps: steps.filter((step) => step.completedAt !== null).length,
      totalSteps: steps.length,
      targetValue,
    })
    if (value !== currentValue) {
      await tx.goal.update({ where: { id: goalId }, data: { currentValue: value } })
      currentValue = value
    }
  }
  const ratio = goalRatio({
    progressMode: goal.progressMode,
    currentValue,
    targetValue,
    initialValue: goal.initialValue === null ? null : toNumber(goal.initialValue),
  })
  const last = await tx.goalProgressEntry.findFirst({
    where: { goalId },
    orderBy: { createdAt: 'desc' },
    select: { value: true, ratio: true },
  })
  if (
    reason === 'created' ||
    !last ||
    toNumber(last.value) !== currentValue ||
    Math.abs(last.ratio - ratio) > 1e-9
  ) {
    await tx.goalProgressEntry.create({
      data: { goalId, userId, value: currentValue, ratio, reason },
    })
  }
}

export function createPrismaGoalsRepository(db: DbClient): GoalsRepository {
  /**
   * Every write to one goal runs here: the goal row is locked first, so two step ticks at once
   * cannot both read the old steps and write a stale number. The recount and its history row
   * commit with the write that caused them.
   */
  function withGoal<T>(
    userId: string,
    goalId: string,
    work: (tx: Tx, goal: { status: string }) => Promise<T>,
  ): Promise<T> {
    return db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status::text AS status FROM goals
        WHERE id = ${goalId}::uuid AND user_id = ${userId}::uuid AND deleted_at IS NULL
        FOR UPDATE
      `
      const goal = locked[0]
      if (!goal) throw new GoalsFailure('not_found', 'Goal not found')
      return work(tx, goal)
    })
  }

  function assertOpen(goal: { status: string }) {
    if (goal.status !== 'active') {
      throw new GoalsFailure('goal_closed', 'Reopen the goal before changing it')
    }
  }

  async function primaryGoalIdFor(client: Tx | DbClient, userId: string) {
    const lifeGoal = await client.lifeGoal.findUnique({
      where: { userId },
      select: { primaryGoalId: true },
    })
    return lifeGoal?.primaryGoalId ?? null
  }

  async function goalDto(client: Tx | DbClient, userId: string, goalId: string) {
    const row = await readGoal(client, userId, goalId)
    return toGoalDto(row, await primaryGoalIdFor(client, userId))
  }

  async function stageOwnedOrFail(client: Tx | DbClient, userId: string, stageId: string) {
    const stage = await client.goalStage.findFirst({
      where: { id: stageId, userId, deletedAt: null, goal: { deletedAt: null } },
      select: { id: true, goalId: true },
    })
    if (!stage) throw new GoalsFailure('not_found', 'Stage not found')
    return stage
  }

  async function stepOwnedOrFail(client: Tx | DbClient, userId: string, stepId: string) {
    const step = await client.goalStep.findFirst({
      where: {
        id: stepId,
        userId,
        deletedAt: null,
        stage: { deletedAt: null, goal: { deletedAt: null } },
      },
      select: { id: true, completedAt: true, stageId: true, stage: { select: { goalId: true } } },
    })
    if (!step) throw new GoalsFailure('not_found', 'Step not found')
    return step
  }

  async function nextPosition(
    client: Tx,
    table: 'goal' | 'goalStage' | 'goalStep',
    where: Record<string, string>,
  ) {
    // Sparse positions are fine: they only order rows. Reusing a freed number would let a
    // delete silently reorder a sibling, which a person would read as the app moving their work.
    const last = await (client[table] as {
      findFirst(args: unknown): Promise<{ position: number } | null>
    }).findFirst({
      where,
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    return (last?.position ?? -1) + 1
  }

  function assertDeadlineNotPast(deadline: string, today: string) {
    if (deadline < today) {
      throw new GoalsFailure('deadline_in_past', 'The deadline cannot be earlier than today')
    }
  }

  /** A closed or trashed goal is never the main one; the person picks a new one. */
  async function clearPrimaryIf(tx: Tx, userId: string, goalIds: string[]) {
    if (goalIds.length === 0) return
    await tx.lifeGoal.updateMany({
      where: { userId, primaryGoalId: { in: goalIds } },
      data: { primaryGoalId: null },
    })
  }

  async function readTree(userId: string): Promise<GoalTreeResponse> {
    const lifeGoal = await db.lifeGoal.findUnique({
      where: { userId },
      select: { id: true, title: true, createdAt: true, primaryGoalId: true, deletedAt: true },
    })
    const goals = await db.goal.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ status: 'asc' }, { position: 'asc' }],
      select: goalSelect,
    })
    return {
      lifeGoal:
        lifeGoal && lifeGoal.deletedAt === null
          ? {
              id: lifeGoal.id,
              title: lifeGoal.title,
              createdAt: lifeGoal.createdAt.toISOString(),
            }
          : null,
      goals: goals.map((goal) => toGoalDto(goal as GoalRow, lifeGoal?.primaryGoalId ?? null)),
    }
  }

  async function createGoalInTx(
    tx: Tx,
    userId: string,
    lifeGoalId: string,
    input: CreateGoalRequest,
  ) {
    const created = await tx.goal.create({
      data: {
        lifeGoalId,
        userId,
        title: input.title,
        description: input.description ?? null,
        deadline: toDayDate(input.deadline),
        measureUnit: input.measureUnit,
        targetValue: input.targetValue,
        initialValue: input.progressMode === 'manual' ? (input.initialValue ?? null) : null,
        // A manual goal starts where the person says it stands today.
        currentValue:
          input.progressMode === 'manual' && input.initialValue != null ? input.initialValue : 0,
        progressMode: input.progressMode,
        deadlineWarningDays: input.deadlineWarningDays,
        creationKey: input.creationKey ?? null,
        position: await nextPosition(tx, 'goal', { lifeGoalId }),
      },
      select: { id: true },
    })
    for (const [stageIndex, stage] of (input.stages ?? []).entries()) {
      const createdStage = await tx.goalStage.create({
        data: {
          goalId: created.id,
          userId,
          title: stage.title,
          description: stage.description ?? null,
          position: stageIndex,
        },
        select: { id: true },
      })
      if (stage.steps.length > 0) {
        await tx.goalStep.createMany({
          data: stage.steps.map((step, stepIndex) => ({
            stageId: createdStage.id,
            userId,
            title: step.title,
            description: step.description ?? null,
            estimatedMinutes: step.estimatedMinutes ?? null,
            position: stepIndex,
          })),
        })
      }
    }
    // The first goal becomes the one the day screen shows: a person who named one goal did not
    // also mean to choose it, and an empty day screen would be the app's fault, not theirs.
    await tx.lifeGoal.updateMany({
      where: { userId, primaryGoalId: null },
      data: { primaryGoalId: created.id },
    })
    await recountGoal(tx, userId, created.id, 'created')
    return goalDto(tx, userId, created.id)
  }

  return {
    readTree,

    async upsertLifeGoal(userId, title) {
      // Naming a life goal after deleting one reuses the row: goals left detached come back
      // under it by themselves (owner's decision on task 12).
      const lifeGoal = await db.lifeGoal.upsert({
        where: { userId },
        create: { userId, title },
        update: { title, deletedAt: null },
        select: { id: true, title: true, createdAt: true },
      })
      return {
        id: lifeGoal.id,
        title: lifeGoal.title,
        createdAt: lifeGoal.createdAt.toISOString(),
      } satisfies LifeGoalDto
    },

    async deleteLifeGoal(userId, mode, now) {
      await db.$transaction(async (tx) => {
        const lifeGoal = await tx.lifeGoal.findFirst({
          where: { userId, deletedAt: null },
          select: { id: true },
        })
        if (!lifeGoal) throw new GoalsFailure('not_found', 'Life goal not found')
        if (mode === 'trash') {
          const goals = await tx.goal.findMany({
            where: { userId, deletedAt: null },
            select: { id: true },
          })
          await tx.goal.updateMany({
            where: { id: { in: goals.map((goal) => goal.id) } },
            data: { deletedAt: now },
          })
          await clearPrimaryIf(tx, userId, goals.map((goal) => goal.id))
        }
        await tx.lifeGoal.update({ where: { id: lifeGoal.id }, data: { deletedAt: now } })
      })
      return readTree(userId)
    },

    async createGoal(userId, input: CreateGoalRequest, today) {
      assertDeadlineNotPast(input.deadline, today)
      if (input.creationKey) {
        const existing = await db.goal.findFirst({
          where: { userId, creationKey: input.creationKey },
          select: { id: true },
        })
        if (existing) return goalDto(db, userId, existing.id)
      }
      try {
        return await db.$transaction(async (tx) => {
          const lifeGoal = await tx.lifeGoal.findFirst({
            where: { userId, deletedAt: null },
            select: { id: true },
          })
          if (!lifeGoal) {
            throw new GoalsFailure(
              'life_goal_required',
              'Create the life goal before adding goals to it',
            )
          }
          return createGoalInTx(tx, userId, lifeGoal.id, input)
        })
      } catch (error) {
        // Two retries of one "Готово" raced: the loser returns the winner's goal.
        if (
          input.creationKey &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const existing = await db.goal.findFirst({
            where: { userId, creationKey: input.creationKey },
            select: { id: true },
          })
          if (existing) return goalDto(db, userId, existing.id)
        }
        throw error
      }
    },

    updateGoal(userId, goalId, input: UpdateGoalRequest, today) {
      return withGoal(userId, goalId, async (tx, locked) => {
        assertOpen(locked)
        const current = await tx.goal.findUniqueOrThrow({
          where: { id: goalId },
          select: {
            deadline: true,
            progressMode: true,
            targetValue: true,
            initialValue: true,
          },
        })
        // Only a changed deadline is checked: an overdue goal renamed keeps its old date.
        if (input.deadline !== undefined && input.deadline !== fromDayDate(current.deadline)) {
          assertDeadlineNotPast(input.deadline, today)
        }
        const mode = input.progressMode ?? current.progressMode
        const initialValue =
          mode === 'manual'
            ? input.initialValue === undefined
              ? current.initialValue === null
                ? null
                : toNumber(current.initialValue)
              : input.initialValue
            : null
        const targetValue = input.targetValue ?? toNumber(current.targetValue)
        if (initialValue === null ? !(targetValue > 0) : targetValue === initialValue) {
          throw new GoalsFailure(
            'invalid_input',
            'The target must differ from the start and be above zero without one',
          )
        }
        await tx.goal.update({
          where: { id: goalId },
          data: {
            ...(input.title === undefined ? {} : { title: input.title }),
            ...(input.description === undefined ? {} : { description: input.description }),
            ...(input.deadline === undefined ? {} : { deadline: toDayDate(input.deadline) }),
            ...(input.measureUnit === undefined ? {} : { measureUnit: input.measureUnit }),
            ...(input.targetValue === undefined ? {} : { targetValue: input.targetValue }),
            ...(input.progressMode === undefined ? {} : { progressMode: input.progressMode }),
            ...(input.deadlineWarningDays === undefined
              ? {}
              : { deadlineWarningDays: input.deadlineWarningDays }),
            initialValue,
          },
        })
        const reason: ProgressReason =
          input.progressMode !== undefined && input.progressMode !== current.progressMode
            ? 'mode'
            : 'target'
        await recountGoal(tx, userId, goalId, reason)
        return goalDto(tx, userId, goalId)
      })
    },

    recordProgress(userId, goalId, currentValue) {
      return withGoal(userId, goalId, async (tx, locked) => {
        if (locked.status !== 'active') {
          throw new GoalsFailure('goal_closed', 'Reopen the goal before recording progress')
        }
        const goal = await tx.goal.findUniqueOrThrow({
          where: { id: goalId },
          select: { progressMode: true },
        })
        if (goal.progressMode !== 'manual') {
          throw new GoalsFailure(
            'progress_not_manual',
            'This goal counts its completed steps; switch it to manual to record a value',
          )
        }
        await tx.goal.update({ where: { id: goalId }, data: { currentValue } })
        // A manual record is history even when the number is the same: the person checked in.
        const updated = await readGoal(tx, userId, goalId)
        await tx.goalProgressEntry.create({
          data: {
            goalId,
            userId,
            value: currentValue,
            ratio: goalRatio({
              progressMode: 'manual',
              currentValue,
              targetValue: toNumber(updated.targetValue),
              initialValue:
                updated.initialValue === null ? null : toNumber(updated.initialValue),
            }),
            reason: 'manual',
          },
        })
        return toGoalDto(updated, await primaryGoalIdFor(tx, userId))
      })
    },

    async readProgressHistory(userId, goalId): Promise<GoalProgressEntryDto[]> {
      await readGoal(db, userId, goalId)
      const entries = await db.goalProgressEntry.findMany({
        where: { goalId, userId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, value: true, ratio: true, reason: true },
      })
      return entries.map((entry) => ({
        at: entry.createdAt.toISOString(),
        value: toNumber(entry.value),
        ratio: entry.ratio,
        reason: entry.reason,
      }))
    },

    closeGoal(userId, goalId, input: CloseGoalRequest, now) {
      return withGoal(userId, goalId, async (tx, locked) => {
        assertOpen(locked)
        await tx.goal.update({
          where: { id: goalId },
          data: { status: input.status, outcomeNote: input.outcomeNote, completedAt: now },
        })
        await clearPrimaryIf(tx, userId, [goalId])
        return goalDto(tx, userId, goalId)
      })
    },

    reopenGoal(userId, goalId, deadline, today) {
      assertDeadlineNotPast(deadline, today)
      return withGoal(userId, goalId, async (tx) => {
        await tx.goal.update({
          where: { id: goalId },
          // The outcome note is kept: it belongs to the attempt that ended, and a goal picked up
          // again is the same goal, now with a record of how it went the first time.
          data: { status: 'active', completedAt: null, deadline: toDayDate(deadline) },
        })
        // An automatic goal froze while closed; steps may have changed since.
        await recountGoal(tx, userId, goalId, 'reopened')
        // With no main goal left, the reopened one takes the place.
        await tx.lifeGoal.updateMany({
          where: { userId, primaryGoalId: null },
          data: { primaryGoalId: goalId },
        })
        return goalDto(tx, userId, goalId)
      })
    },

    setPrimaryGoal(userId, goalId) {
      return withGoal(userId, goalId, async (tx, locked) => {
        if (locked.status !== 'active') {
          throw new GoalsFailure('goal_closed', 'Only a goal in work can be the main one')
        }
        await tx.lifeGoal.update({ where: { userId }, data: { primaryGoalId: goalId } })
        return goalDto(tx, userId, goalId)
      })
    },

    async trashGoal(userId, goalId, now) {
      await withGoal(userId, goalId, async (tx) => {
        await tx.goal.update({ where: { id: goalId }, data: { deletedAt: now } })
        await clearPrimaryIf(tx, userId, [goalId])
      })
      // The tree, not nothing: the primary pointer may have moved, and the client would
      // otherwise have to guess.
      return readTree(userId)
    },

    async createStage(userId, goalId, input: CreateStageRequest) {
      return withGoal(userId, goalId, async (tx, locked) => {
        assertOpen(locked)
        await tx.goalStage.create({
          data: {
            goalId,
            userId,
            title: input.title,
            description: input.description ?? null,
            position: await nextPosition(tx, 'goalStage', { goalId }),
          },
        })
        return goalDto(tx, userId, goalId)
      })
    },

    async updateStage(userId, stageId, input: UpdateStageRequest) {
      const stage = await stageOwnedOrFail(db, userId, stageId)
      return withGoal(userId, stage.goalId, async (tx, locked) => {
        assertOpen(locked)
        await tx.goalStage.update({
          where: { id: stageId },
          data: {
            ...(input.title === undefined ? {} : { title: input.title }),
            ...(input.description === undefined ? {} : { description: input.description }),
          },
        })
        return goalDto(tx, userId, stage.goalId)
      })
    },

    async trashStage(userId, stageId, now) {
      const stage = await stageOwnedOrFail(db, userId, stageId)
      return withGoal(userId, stage.goalId, async (tx, locked) => {
        assertOpen(locked)
        await tx.goalStage.update({ where: { id: stageId }, data: { deletedAt: now } })
        await recountGoal(tx, userId, stage.goalId, 'steps')
        return goalDto(tx, userId, stage.goalId)
      })
    },

    reorderStages(userId, goalId, stageIds) {
      return withGoal(userId, goalId, async (tx, locked) => {
        assertOpen(locked)
        const stages = await tx.goalStage.findMany({
          where: { goalId, userId, deletedAt: null },
          select: { id: true },
        })
        assertSameIds(stages.map((stage) => stage.id), stageIds)
        for (const [position, id] of stageIds.entries()) {
          await tx.goalStage.update({ where: { id }, data: { position } })
        }
        return goalDto(tx, userId, goalId)
      })
    },

    async createStep(userId, stageId, input: CreateStepRequest) {
      const stage = await stageOwnedOrFail(db, userId, stageId)
      return withGoal(userId, stage.goalId, async (tx, locked) => {
        assertOpen(locked)
        await tx.goalStep.create({
          data: {
            stageId,
            userId,
            title: input.title,
            description: input.description ?? null,
            estimatedMinutes: input.estimatedMinutes ?? null,
            position: await nextPosition(tx, 'goalStep', { stageId }),
          },
        })
        await recountGoal(tx, userId, stage.goalId, 'steps')
        return goalDto(tx, userId, stage.goalId)
      })
    },

    async updateStep(userId, stepId, input: UpdateStepRequest, now) {
      const step = await stepOwnedOrFail(db, userId, stepId)
      return withGoal(userId, step.stage.goalId, async (tx, locked) => {
        assertOpen(locked)
        // Read again under the lock: the completion moment must be the stored one.
        const fresh = await stepOwnedOrFail(tx, userId, stepId)
        await tx.goalStep.update({
          where: { id: stepId },
          data: {
            ...(input.title === undefined ? {} : { title: input.title }),
            ...(input.description === undefined ? {} : { description: input.description }),
            ...(input.estimatedMinutes === undefined
              ? {}
              : { estimatedMinutes: input.estimatedMinutes }),
            // Re-completing an already completed step keeps its original moment: the day it
            // was done is a fact, and a stray tap must not rewrite it.
            ...(input.isCompleted === undefined
              ? {}
              : { completedAt: input.isCompleted ? (fresh.completedAt ?? now) : null }),
          },
        })
        await recountGoal(tx, userId, step.stage.goalId, 'steps')
        return goalDto(tx, userId, step.stage.goalId)
      })
    },

    async trashStep(userId, stepId, now) {
      const step = await stepOwnedOrFail(db, userId, stepId)
      return withGoal(userId, step.stage.goalId, async (tx, locked) => {
        assertOpen(locked)
        await tx.goalStep.update({ where: { id: stepId }, data: { deletedAt: now } })
        await recountGoal(tx, userId, step.stage.goalId, 'steps')
        return goalDto(tx, userId, step.stage.goalId)
      })
    },

    async reorderSteps(userId, stageId, stepIds) {
      const stage = await stageOwnedOrFail(db, userId, stageId)
      return withGoal(userId, stage.goalId, async (tx, locked) => {
        assertOpen(locked)
        const steps = await tx.goalStep.findMany({
          where: { stageId, userId, deletedAt: null },
          select: { id: true },
        })
        assertSameIds(steps.map((step) => step.id), stepIds)
        for (const [position, id] of stepIds.entries()) {
          await tx.goalStep.update({ where: { id }, data: { position } })
        }
        return goalDto(tx, userId, stage.goalId)
      })
    },
  }
}

function assertSameIds(existing: string[], requested: string[]) {
  const wanted = new Set(requested)
  if (
    wanted.size !== requested.length ||
    existing.length !== requested.length ||
    existing.some((id) => !wanted.has(id))
  ) {
    throw new GoalsFailure('invalid_input', 'The new order must name every row exactly once')
  }
}

function toGoalDto(row: GoalRow, primaryGoalId: string | null): GoalDto {
  const targetValue = toNumber(row.targetValue)
  const currentValue = toNumber(row.currentValue)
  const initialValue = row.initialValue === null ? null : toNumber(row.initialValue)
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    deadline: fromDayDate(row.deadline),
    measureUnit: row.measureUnit,
    targetValue,
    currentValue,
    initialValue,
    progressRatio: goalRatio({
      progressMode: row.progressMode,
      currentValue,
      targetValue,
      initialValue,
    }),
    deadlineWarningDays: row.deadlineWarningDays,
    progressMode: row.progressMode,
    status: row.status,
    isPrimary: row.id === primaryGoalId && row.status === 'active',
    outcomeNote: row.outcomeNote,
    position: row.position,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    stages: row.stages.map((stage) => ({
      id: stage.id,
      title: stage.title,
      description: stage.description,
      position: stage.position,
      steps: stage.steps.map((step) => ({
        id: step.id,
        title: step.title,
        description: step.description,
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
