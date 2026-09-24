import {
  compareTasksInDay,
  ruleDates,
  ruleMatches,
  type ApplyTemplateRequest,
  type CreateCategoryRequest,
  type CreateSubtaskRequest,
  type CreateTaskRequest,
  type CreateTemplateItemRequest,
  type CreateTemplateRequest,
  type DayTemplateDto,
  type RepeatTaskRequest,
  type ScheduleRuleDto,
  type TaskCategoryDto,
  type TaskDto,
  type UpdateCategoryRequest,
  type UpdateSubtaskRequest,
  type UpdateTaskRequest,
  type UpdateTemplateItemRequest,
  type UpdateTemplateRequest,
} from '@dilife/contracts'

import type { DbClient } from '../../../db'
import { Prisma } from '../../../generated/prisma/client'
import type { DayRepository } from '../application/ports'
import { DayFailure } from '../domain/errors'

type Tx = Prisma.TransactionClient
type Client = Tx | DbClient

/** How far ahead a repeat puts its occurrences into the plan (task 18). */
export const SERIES_HORIZON_DAYS = 14

/** The owner's starter categories (task 14), in colours readable on both themes' cards. */
const starterCategories = [
  { title: 'Работа', color: '#3b82f6' },
  { title: 'Спорт', color: '#16a34a' },
  { title: 'Семья', color: '#ea580c' },
] as const

const seriesSelect = {
  id: true,
  ruleKind: true,
  weekdays: true,
  monthDays: true,
  dates: true,
  startsOn: true,
  endsOn: true,
} as const

const taskSelect = {
  id: true,
  scheduledOn: true,
  startMinute: true,
  durationMinutes: true,
  title: true,
  description: true,
  priority: true,
  outcome: true,
  completedAt: true,
  movedFrom: true,
  colorOverride: true,
  categoryId: true,
  stepId: true,
  position: true,
  seriesId: true,
  series: { select: seriesSelect },
  subtasks: {
    orderBy: { position: 'asc' },
    select: { id: true, title: true, completedAt: true, position: true },
  },
} as const

type RuleKind = 'daily' | 'weekdays' | 'monthdays' | 'dates'

type SeriesRuleRow = {
  id: string
  ruleKind: RuleKind
  weekdays: number[]
  monthDays: number[]
  dates: Date[]
  startsOn: Date
  endsOn: Date | null
}

type TaskRow = {
  id: string
  scheduledOn: Date
  startMinute: number | null
  durationMinutes: number
  title: string
  description: string | null
  priority: 'normal' | 'important' | 'urgent'
  outcome: 'planned' | 'done' | 'burned'
  completedAt: Date | null
  movedFrom: Date | null
  colorOverride: string | null
  categoryId: string | null
  stepId: string | null
  position: number
  seriesId: string | null
  series: SeriesRuleRow | null
  subtasks: Array<{ id: string; title: string; completedAt: Date | null; position: number }>
}

/**
 * A day is a date, not a moment. Postgres `date` columns come back as a Date at UTC midnight, so
 * both directions go through these two helpers rather than through the local time zone, which
 * would shift a task a day either way depending on where the server runs.
 */
function toDayDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`)
}

function fromDayDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function shiftDate(date: string, days: number) {
  const shifted = toDayDate(date)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return fromDayDate(shifted)
}

function ruleFromRow(row: {
  ruleKind: RuleKind
  weekdays: number[]
  monthDays: number[]
  dates?: Date[]
}): ScheduleRuleDto {
  switch (row.ruleKind) {
    case 'daily':
      return { kind: 'daily' }
    case 'weekdays':
      return { kind: 'weekdays', weekdays: row.weekdays }
    case 'monthdays':
      return { kind: 'monthdays', monthDays: row.monthDays }
    case 'dates':
      return { kind: 'dates', dates: (row.dates ?? []).map(fromDayDate) }
  }
}

function ruleColumns(rule: ScheduleRuleDto) {
  return {
    ruleKind: rule.kind,
    weekdays: rule.kind === 'weekdays' ? [...new Set(rule.weekdays)].sort((a, b) => a - b) : [],
    monthDays: rule.kind === 'monthdays' ? [...new Set(rule.monthDays)].sort((a, b) => a - b) : [],
  }
}

async function nextPosition(
  client: Client,
  table: 'task' | 'taskSubtask' | 'taskCategory' | 'dayTemplate' | 'dayTemplateItem',
  where: Record<string, unknown>,
) {
  const last = await (client[table] as unknown as {
    findFirst(args: unknown): Promise<{ position: number } | null>
  }).findFirst({ where, orderBy: { position: 'desc' }, select: { position: true } })
  return (last?.position ?? -1) + 1
}

/**
 * Puts a series' occurrences on the days from `from` to `to`. Safe to run any number of times:
 * the (series, day) pair is unique, and a day taken out of the series is never made again.
 */
async function materializeSeriesIn(
  client: Client,
  where: Prisma.TaskSeriesWhereInput,
  from: string,
  to: string,
) {
  const series = await client.taskSeries.findMany({
    where: {
      ...where,
      startsOn: { lte: toDayDate(to) },
      OR: [{ endsOn: null }, { endsOn: { gte: toDayDate(from) } }],
    },
  })
  let created = 0
  for (const one of series) {
    const start = fromDayDate(one.startsOn) > from ? fromDayDate(one.startsOn) : from
    const end = one.endsOn && fromDayDate(one.endsOn) < to ? fromDayDate(one.endsOn) : to
    if (start > end) continue
    const excluded = new Set(one.excludedDates.map(fromDayDate))
    const days = ruleDates(ruleFromRow(one), start, end).filter((day) => !excluded.has(day))
    if (days.length === 0) continue
    const existing = await client.task.findMany({
      where: { seriesId: one.id, seriesDate: { in: days.map(toDayDate) } },
      select: { seriesDate: true },
    })
    const have = new Set(existing.map((task) => fromDayDate(task.seriesDate!)))
    for (const day of days) {
      if (have.has(day)) continue
      const scheduledOn = toDayDate(day)
      const result = await client.task.createMany({
        data: [
          {
            userId: one.userId,
            scheduledOn,
            title: one.title,
            description: one.description,
            startMinute: one.startMinute,
            durationMinutes: one.durationMinutes,
            priority: one.priority,
            categoryId: one.categoryId,
            colorOverride: one.colorOverride,
            seriesId: one.id,
            seriesDate: scheduledOn,
            position: await nextPosition(client, 'task', { userId: one.userId, scheduledOn }),
          },
        ],
        skipDuplicates: true,
      })
      created += result.count
    }
  }
  return created
}

async function addTemplateTasks(tx: Tx, userId: string, templateId: string, day: string) {
  const items = await tx.dayTemplateItem.findMany({
    where: { templateId },
    orderBy: { position: 'asc' },
    select: {
      title: true,
      startMinute: true,
      durationMinutes: true,
      priority: true,
      categoryId: true,
    },
  })
  // A category deleted since the item was written leaves the task without one (task 14).
  const wanted = items.flatMap((item) => (item.categoryId ? [item.categoryId] : []))
  const liveCategories = new Set(
    (
      await tx.taskCategory.findMany({
        where: { userId, id: { in: wanted } },
        select: { id: true },
      })
    ).map((category) => category.id),
  )
  const scheduledOn = toDayDate(day)
  let position = await nextPosition(tx, 'task', { userId, scheduledOn })
  for (const item of items) {
    await tx.task.create({
      data: {
        userId,
        scheduledOn,
        title: item.title,
        startMinute: item.startMinute,
        durationMinutes: item.durationMinutes,
        priority: item.priority,
        categoryId:
          item.categoryId && liveCategories.has(item.categoryId) ? item.categoryId : null,
        position,
      },
    })
    position += 1
  }
}

/**
 * Applies templates whose rule picks one of the days, once per template and day: the
 * application row is written first, so a second pass - or a task deleted from the day - never
 * brings the template's tasks back (task 17).
 */
async function applyScheduledTemplatesIn(
  db: DbClient,
  where: Prisma.DayTemplateWhereInput,
  days: string[],
) {
  if (days.length === 0) return 0
  const templates = await db.dayTemplate.findMany({
    where: { ...where, ruleKind: { not: null } },
    select: {
      id: true,
      userId: true,
      ruleKind: true,
      weekdays: true,
      monthDays: true,
      ruleFrom: true,
    },
  })
  let applied = 0
  for (const template of templates) {
    const rule = ruleFromRow({
      ruleKind: template.ruleKind!,
      weekdays: template.weekdays,
      monthDays: template.monthDays,
    })
    for (const day of days) {
      if (template.ruleFrom && day < fromDayDate(template.ruleFrom)) continue
      if (!ruleMatches(rule, day)) continue
      try {
        await db.$transaction(async (tx) => {
          await tx.dayTemplateApplication.create({
            data: {
              templateId: template.id,
              userId: template.userId,
              appliedOn: toDayDate(day),
              automatic: true,
            },
          })
          await addTemplateTasks(tx, template.userId, template.id, day)
        })
        applied += 1
      } catch (error) {
        // Applied already, by hand or by another pass: nothing to add.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          continue
        }
        throw error
      }
    }
  }
  return applied
}

/**
 * The background half of repeats and scheduled templates: tomorrow onwards in UTC, so no one's
 * past day is filled while they are away (tasks 17, 18, 21). The day screen fills the person's
 * own today when it is opened.
 */
export async function materializeUpcomingPlans(db: DbClient, now: Date) {
  const today = fromDayDate(now)
  const from = shiftDate(today, 1)
  const occurrences = await materializeSeriesIn(
    db,
    {},
    from,
    shiftDate(today, SERIES_HORIZON_DAYS),
  )
  const templates = await applyScheduledTemplatesIn(db, {}, [from])
  return { occurrences, templates }
}

export function createPrismaDayRepository(db: DbClient): DayRepository {
  async function readDay(userId: string, date: string, dayStartMinute: number) {
    const tasks = await db.task.findMany({
      where: { userId, scheduledOn: toDayDate(date), deletedAt: null },
      select: taskSelect,
    })
    const dtos = tasks.map((task) => toTaskDto(task as TaskRow))
    return { date, tasks: dtos.sort(compareTasksInDay(dayStartMinute)) }
  }

  async function taskOrFail(client: Client, userId: string, taskId: string) {
    const task = await client.task.findFirst({
      where: { id: taskId, userId, deletedAt: null },
      select: {
        id: true,
        outcome: true,
        completedAt: true,
        scheduledOn: true,
        stepId: true,
        seriesId: true,
        seriesDate: true,
        title: true,
        description: true,
        startMinute: true,
        durationMinutes: true,
        priority: true,
        categoryId: true,
        colorOverride: true,
      },
    })
    if (!task) throw new DayFailure('not_found', 'Task not found')
    return task
  }

  async function readTask(client: Client, userId: string, taskId: string): Promise<TaskDto> {
    const task = await client.task.findFirst({
      where: { id: taskId, userId, deletedAt: null },
      select: taskSelect,
    })
    if (!task) throw new DayFailure('not_found', 'Task not found')
    return toTaskDto(task as TaskRow)
  }

  async function readCategories(userId: string): Promise<TaskCategoryDto[]> {
    const [categories, itemCounts] = await Promise.all([
      db.taskCategory.findMany({
        where: { userId },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          color: true,
          position: true,
          _count: { select: { tasks: { where: { deletedAt: null } } } },
        },
      }),
      db.dayTemplateItem.groupBy({
        by: ['categoryId'],
        where: { userId, categoryId: { not: null } },
        _count: { _all: true },
      }),
    ])
    const items = new Map(itemCounts.map((row) => [row.categoryId, row._count._all]))
    return categories.map((category) => ({
      id: category.id,
      title: category.title,
      color: category.color,
      position: category.position,
      usage: { tasks: category._count.tasks, templateItems: items.get(category.id) ?? 0 },
    }))
  }

  async function readTemplates(userId: string): Promise<DayTemplateDto[]> {
    const templates = await db.dayTemplate.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        title: true,
        position: true,
        ruleKind: true,
        weekdays: true,
        monthDays: true,
        items: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            startMinute: true,
            durationMinutes: true,
            priority: true,
            categoryId: true,
            position: true,
          },
        },
      },
    })
    return templates.map(({ ruleKind, weekdays, monthDays, ...template }) => ({
      ...template,
      rule: ruleKind ? ruleFromRow({ ruleKind, weekdays, monthDays }) : null,
    }))
  }

  /** Offers the starter categories once, the first time the day opens (task 14). */
  async function ensureStarterCategories(userId: string, now: Date) {
    const select = { starterCategoriesAt: true } as const
    // Two first opens at once both try to create the row; the loser reads the winner's.
    const profile = await db.dayProfile
      .upsert({ where: { userId }, create: { userId }, update: {}, select })
      .catch(async (error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return db.dayProfile.findUniqueOrThrow({ where: { userId }, select })
        }
        throw error
      })
    if (profile.starterCategoriesAt) return
    await db.$transaction(async (tx) => {
      const marked = await tx.dayProfile.updateMany({
        where: { userId, starterCategoriesAt: null },
        data: { starterCategoriesAt: now },
      })
      if (marked.count === 0) return
      // An account that already made its own categories keeps its list as it is.
      if ((await tx.taskCategory.count({ where: { userId } })) > 0) return
      await tx.taskCategory.createMany({
        data: starterCategories.map((category, position) => ({ userId, ...category, position })),
      })
    })
  }

  async function subtaskOrFail(userId: string, subtaskId: string) {
    const subtask = await db.taskSubtask.findFirst({
      where: { id: subtaskId, userId, task: { deletedAt: null } },
      select: { id: true, taskId: true, completedAt: true },
    })
    if (!subtask) throw new DayFailure('not_found', 'Subtask not found')
    return subtask
  }

  /** A category id is accepted only when it belongs to this person; anything else is a 404. */
  async function ownedCategoryId(client: Client, userId: string, categoryId: string | null) {
    if (categoryId === null) return null
    const category = await client.taskCategory.findFirst({
      where: { id: categoryId, userId },
      select: { id: true },
    })
    if (!category) throw new DayFailure('not_found', 'Category not found')
    return category.id
  }

  /**
   * A step is accepted only when it belongs to this person and its goal is in work: a closed goal
   * or anything in the trash takes no new tasks (task 16). Returns the step's estimate too.
   */
  async function ownedStep(client: Client, userId: string, stepId: string | null) {
    if (stepId === null) return null
    const step = await client.goalStep.findFirst({
      where: {
        id: stepId,
        userId,
        deletedAt: null,
        stage: { deletedAt: null, goal: { deletedAt: null, status: 'active' } },
      },
      select: { id: true, estimatedMinutes: true },
    })
    if (!step) throw new DayFailure('not_found', 'Step not found')
    return step
  }

  /** Occurrences of a series still open and not changed by hand, from `from` on. */
  function untouchedFrom(seriesId: string, from: Date) {
    return {
      seriesId,
      seriesDate: { gte: from },
      seriesDetached: false,
      outcome: 'planned' as const,
      deletedAt: null,
    }
  }

  return {
    readDay,

    async materializeDay(userId, date) {
      await materializeSeriesIn(db, { userId }, date, date)
      await applyScheduledTemplatesIn(db, { userId }, [date])
    },

    async readContext(userId, now) {
      await ensureStarterCategories(userId, now)
      return {
        categories: await readCategories(userId),
        templates: await readTemplates(userId),
      }
    },

    async createTask(userId, input: CreateTaskRequest, defaultMinutes) {
      const scheduledOn = toDayDate(input.scheduledOn)
      const step = await ownedStep(db, userId, input.stepId ?? null)
      const created = await db.task.create({
        data: {
          userId,
          scheduledOn,
          title: input.title,
          description: input.description ?? null,
          startMinute: input.startMinute ?? null,
          // A step brings its own estimate; otherwise the person's default (task 16).
          durationMinutes: input.durationMinutes ?? step?.estimatedMinutes ?? defaultMinutes,
          priority: input.priority,
          categoryId: await ownedCategoryId(db, userId, input.categoryId ?? null),
          stepId: step?.id ?? null,
          colorOverride: input.colorOverride ?? null,
          position: await nextPosition(db, 'task', { userId, scheduledOn }),
        },
        select: taskSelect,
      })
      return toTaskDto(created as TaskRow)
    },

    async updateTask(userId, taskId, input: UpdateTaskRequest, now) {
      return db.$transaction(async (tx) => {
        const task = await taskOrFail(tx, userId, taskId)
        if (input.stepId !== undefined && input.stepId !== null && task.seriesId) {
          throw new DayFailure('repeat_with_step', 'A repeating task cannot be a goal step')
        }
        const fields = {
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.startMinute === undefined ? {} : { startMinute: input.startMinute }),
          ...(input.durationMinutes === undefined
            ? {}
            : { durationMinutes: input.durationMinutes }),
          ...(input.priority === undefined ? {} : { priority: input.priority }),
          ...(input.categoryId === undefined
            ? {}
            : { categoryId: await ownedCategoryId(tx, userId, input.categoryId) }),
          ...(input.colorOverride === undefined ? {} : { colorOverride: input.colorOverride }),
        }
        const changesShape = Object.keys(fields).length > 0

        await tx.task.update({
          where: { id: taskId },
          data: {
            ...fields,
            ...(input.scheduledOn === undefined
              ? {}
              : { scheduledOn: toDayDate(input.scheduledOn) }),
            ...(input.stepId === undefined
              ? {}
              : { stepId: (await ownedStep(tx, userId, input.stepId))?.id ?? null }),
            // Completing keeps the moment it was first done, so a stray tap cannot rewrite the
            // day something happened. Un-completing returns the task to the plan.
            ...(input.isCompleted === undefined
              ? {}
              : input.isCompleted
                ? { outcome: 'done' as const, completedAt: task.completedAt ?? now }
                : { outcome: 'planned' as const, completedAt: null }),
            // «Только эта»: later changes to the series leave this occurrence alone (task 18).
            ...(task.seriesId && changesShape && input.scope !== 'following'
              ? { seriesDetached: true }
              : {}),
          },
        })

        // «Эта и следующие»: the series and every later occurrence nobody changed by hand.
        if (task.seriesId && changesShape && input.scope === 'following') {
          await tx.taskSeries.update({ where: { id: task.seriesId }, data: fields })
          await tx.task.updateMany({
            where: {
              ...untouchedFrom(task.seriesId, task.seriesDate ?? task.scheduledOn),
              id: { not: taskId },
            },
            data: fields,
          })
        }
        return readTask(tx, userId, taskId)
      })
    },

    async repeatTask(userId, taskId, input: RepeatTaskRequest, today, now) {
      return db.$transaction(async (tx) => {
        const task = await taskOrFail(tx, userId, taskId)
        if (task.stepId) {
          // The owner's decision on task 18: a goal step is planned by hand, never repeated.
          throw new DayFailure('repeat_with_step', 'A goal step does not repeat')
        }
        const rule = input.rule
        const endsOn = input.endsOn ? toDayDate(input.endsOn) : null
        const dates = rule.kind === 'dates' ? rule.dates.map(toDayDate) : []
        let seriesId = task.seriesId
        if (seriesId) {
          await tx.taskSeries.update({
            where: { id: seriesId },
            data: { ...ruleColumns(rule), dates, endsOn },
          })
          // Future occurrences nobody touched follow the new rule: those it no longer picks go
          // to the trash, and the missing ones are made below.
          const future = await tx.task.findMany({
            where: untouchedFrom(seriesId, toDayDate(shiftDate(today, 1))),
            select: { id: true, seriesDate: true },
          })
          const stale = future.filter((occurrence) => {
            const day = fromDayDate(occurrence.seriesDate!)
            return !ruleMatches(rule, day) || (input.endsOn != null && day > input.endsOn)
          })
          await tx.task.updateMany({
            where: { id: { in: stale.map((occurrence) => occurrence.id) } },
            data: { deletedAt: now },
          })
        } else {
          const created = await tx.taskSeries.create({
            data: {
              userId,
              title: task.title,
              description: task.description,
              startMinute: task.startMinute,
              durationMinutes: task.durationMinutes,
              priority: task.priority,
              categoryId: task.categoryId,
              colorOverride: task.colorOverride,
              ...ruleColumns(rule),
              dates,
              startsOn: task.scheduledOn,
              endsOn,
            },
            select: { id: true },
          })
          seriesId = created.id
          await tx.task.update({
            where: { id: taskId },
            data: { seriesId, seriesDate: task.scheduledOn },
          })
        }
        // Dates chosen in the past make nothing: only today and the days ahead fill.
        const from =
          today > fromDayDate(task.scheduledOn) ? today : fromDayDate(task.scheduledOn)
        await materializeSeriesIn(
          tx,
          { id: seriesId },
          from,
          shiftDate(today, SERIES_HORIZON_DAYS),
        )
        return readTask(tx, userId, taskId)
      })
    },

    async stopRepeat(userId, seriesId, today, now) {
      await db.$transaction(async (tx) => {
        const series = await tx.taskSeries.findFirst({
          where: { id: seriesId, userId },
          select: { id: true },
        })
        if (!series) throw new DayFailure('not_found', 'Repeat not found')
        await tx.taskSeries.update({ where: { id: seriesId }, data: { endsOn: toDayDate(today) } })
        await tx.task.updateMany({
          where: untouchedFrom(seriesId, toDayDate(shiftDate(today, 1))),
          data: { deletedAt: now },
        })
      })
    },

    async resolveTask(userId, taskId, input) {
      const task = await taskOrFail(db, userId, taskId)
      if (task.outcome === 'done') {
        throw new DayFailure('task_already_resolved', 'This task is already done')
      }
      if (input.action === 'burn') {
        await db.task.update({ where: { id: taskId }, data: { outcome: 'burned' } })
        return readTask(db, userId, taskId)
      }
      const scheduledOn = toDayDate(input.scheduledOn)
      await db.task.update({
        where: { id: taskId },
        data: {
          scheduledOn,
          // Remembered so the new day can say where this came from instead of pretending it
          // was always there.
          movedFrom: task.scheduledOn,
          outcome: 'planned',
          position: await nextPosition(db, 'task', { userId, scheduledOn }),
        },
      })
      return readTask(db, userId, taskId)
    },

    async deleteTask(userId, taskId, now, scope, dayStartMinute) {
      const task = await db.$transaction(async (tx) => {
        const found = await taskOrFail(tx, userId, taskId)
        // To the trash, not gone: it can be restored for 30 days (task 11).
        await tx.task.update({ where: { id: taskId }, data: { deletedAt: now } })
        if (found.seriesId && found.seriesDate) {
          if (scope === 'following') {
            // The series ends the day before; later untouched occurrences go with this one.
            await tx.taskSeries.update({
              where: { id: found.seriesId },
              data: { endsOn: toDayDate(shiftDate(fromDayDate(found.seriesDate), -1)) },
            })
            await tx.task.updateMany({
              where: untouchedFrom(found.seriesId, found.seriesDate),
              data: { deletedAt: now },
            })
          } else {
            // Never made again, even once the trash is emptied (task 18).
            await tx.taskSeries.update({
              where: { id: found.seriesId },
              data: { excludedDates: { push: found.seriesDate } },
            })
          }
        }
        return found
      })
      // The day, not nothing: the screen re-renders from one response instead of guessing what
      // the deletion left behind.
      return readDay(userId, fromDayDate(task.scheduledOn), dayStartMinute)
    },

    async createSubtask(userId, taskId, input: CreateSubtaskRequest) {
      await taskOrFail(db, userId, taskId)
      await db.taskSubtask.create({
        data: {
          taskId,
          userId,
          title: input.title,
          position: await nextPosition(db, 'taskSubtask', { taskId }),
        },
      })
      return readTask(db, userId, taskId)
    },

    async updateSubtask(userId, subtaskId, input: UpdateSubtaskRequest, now) {
      const subtask = await subtaskOrFail(userId, subtaskId)
      await db.taskSubtask.update({
        where: { id: subtaskId },
        data: {
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.isCompleted === undefined
            ? {}
            : { completedAt: input.isCompleted ? (subtask.completedAt ?? now) : null }),
        },
      })
      return readTask(db, userId, subtask.taskId)
    },

    async deleteSubtask(userId, subtaskId) {
      const subtask = await subtaskOrFail(userId, subtaskId)
      await db.taskSubtask.delete({ where: { id: subtaskId } })
      return readTask(db, userId, subtask.taskId)
    },

    async readStepPlans(userId, from) {
      const tasks = await db.task.findMany({
        where: {
          userId,
          stepId: { not: null },
          outcome: 'planned',
          deletedAt: null,
          scheduledOn: { gte: toDayDate(from) },
        },
        orderBy: { scheduledOn: 'asc' },
        select: { stepId: true, scheduledOn: true },
      })
      return tasks.map((task) => ({
        stepId: task.stepId!,
        scheduledOn: fromDayDate(task.scheduledOn),
      }))
    },

    async createCategory(userId, input: CreateCategoryRequest) {
      await db.taskCategory.create({
        data: {
          userId,
          title: input.title,
          color: input.color,
          position: await nextPosition(db, 'taskCategory', { userId }),
        },
      })
      return readCategories(userId)
    },

    async updateCategory(userId, categoryId, input: UpdateCategoryRequest) {
      const updated = await db.taskCategory.updateMany({
        where: { id: categoryId, userId },
        data: {
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.color === undefined ? {} : { color: input.color }),
        },
      })
      if (updated.count === 0) throw new DayFailure('not_found', 'Category not found')
      return readCategories(userId)
    },

    async deleteCategory(userId, categoryId) {
      // Tasks keep their place in the day and lose only the colour: deleting a category must
      // not delete work filed under it. Template items and repeats let go of it in the same
      // transaction, so applying a template never trips over a missing category (task 14).
      await db.$transaction(async (tx) => {
        const deleted = await tx.taskCategory.deleteMany({ where: { id: categoryId, userId } })
        if (deleted.count === 0) throw new DayFailure('not_found', 'Category not found')
        await tx.dayTemplateItem.updateMany({
          where: { userId, categoryId },
          data: { categoryId: null },
        })
        await tx.taskSeries.updateMany({ where: { userId, categoryId }, data: { categoryId: null } })
      })
      return readCategories(userId)
    },

    async createTemplate(userId, input: CreateTemplateRequest) {
      await db.dayTemplate.create({
        data: {
          userId,
          title: input.title,
          position: await nextPosition(db, 'dayTemplate', { userId }),
        },
      })
      return readTemplates(userId)
    },

    async updateTemplate(userId, templateId, input: UpdateTemplateRequest, today) {
      const template = await db.dayTemplate.findFirst({
        where: { id: templateId, userId },
        select: { id: true },
      })
      if (!template) throw new DayFailure('not_found', 'Template not found')
      await db.dayTemplate.update({
        where: { id: templateId },
        data: {
          ...(input.title === undefined ? {} : { title: input.title }),
          // Chosen dates are a repeat's rule, not a template's: they read as "by hand".
          ...(input.rule === undefined
            ? {}
            : input.rule === null || input.rule.kind === 'dates'
              ? { ruleKind: null, weekdays: [], monthDays: [], ruleFrom: null }
              : { ...ruleColumns(input.rule), ruleFrom: toDayDate(today) }),
        },
      })
      return readTemplates(userId)
    },

    async deleteTemplate(userId, templateId) {
      const deleted = await db.dayTemplate.deleteMany({ where: { id: templateId, userId } })
      if (deleted.count === 0) throw new DayFailure('not_found', 'Template not found')
      return readTemplates(userId)
    },

    async createTemplateItem(
      userId,
      templateId,
      input: CreateTemplateItemRequest,
      defaultMinutes,
    ) {
      const template = await db.dayTemplate.findFirst({
        where: { id: templateId, userId },
        select: { id: true },
      })
      if (!template) throw new DayFailure('not_found', 'Template not found')
      await db.dayTemplateItem.create({
        data: {
          templateId,
          userId,
          title: input.title,
          startMinute: input.startMinute ?? null,
          durationMinutes: input.durationMinutes ?? defaultMinutes,
          priority: input.priority,
          categoryId: await ownedCategoryId(db, userId, input.categoryId ?? null),
          position: await nextPosition(db, 'dayTemplateItem', { templateId }),
        },
      })
      return readTemplates(userId)
    },

    async updateTemplateItem(userId, itemId, input: UpdateTemplateItemRequest) {
      const item = await db.dayTemplateItem.findFirst({
        where: { id: itemId, userId },
        select: { id: true },
      })
      if (!item) throw new DayFailure('not_found', 'Template item not found')
      await db.dayTemplateItem.update({
        where: { id: itemId },
        data: {
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.startMinute === undefined ? {} : { startMinute: input.startMinute }),
          ...(input.durationMinutes === undefined
            ? {}
            : { durationMinutes: input.durationMinutes }),
          ...(input.priority === undefined ? {} : { priority: input.priority }),
          ...(input.categoryId === undefined
            ? {}
            : { categoryId: await ownedCategoryId(db, userId, input.categoryId) }),
        },
      })
      return readTemplates(userId)
    },

    async deleteTemplateItem(userId, itemId) {
      const deleted = await db.dayTemplateItem.deleteMany({ where: { id: itemId, userId } })
      if (deleted.count === 0) throw new DayFailure('not_found', 'Template item not found')
      return readTemplates(userId)
    },

    async applyTemplate(userId, input: ApplyTemplateRequest, dayStartMinute) {
      const template = await db.dayTemplate.findFirst({
        where: { id: input.templateId, userId },
        select: { id: true },
      })
      if (!template) throw new DayFailure('not_found', 'Template not found')
      // One transaction: a failure halfway leaves none of the items, not some (task 17). Added
      // to the day rather than replacing it: "and also this", not "instead of that".
      await db.$transaction(async (tx) => {
        await addTemplateTasks(tx, userId, input.templateId, input.scheduledOn)
        await tx.dayTemplateApplication.upsert({
          where: {
            templateId_appliedOn: {
              templateId: input.templateId,
              appliedOn: toDayDate(input.scheduledOn),
            },
          },
          create: {
            templateId: input.templateId,
            userId,
            appliedOn: toDayDate(input.scheduledOn),
          },
          update: {},
        })
      })
      return readDay(userId, input.scheduledOn, dayStartMinute)
    },

    async saveDayAsTemplate(userId, input) {
      const tasks = await db.task.findMany({
        where: { userId, scheduledOn: toDayDate(input.date), deletedAt: null },
        orderBy: [{ startMinute: 'asc' }, { position: 'asc' }],
        select: {
          title: true,
          startMinute: true,
          durationMinutes: true,
          priority: true,
          categoryId: true,
        },
      })
      await db.$transaction(async (tx) => {
        const template = await tx.dayTemplate.create({
          data: {
            userId,
            title: input.title,
            position: await nextPosition(tx, 'dayTemplate', { userId }),
          },
          select: { id: true },
        })
        await tx.dayTemplateItem.createMany({
          data: tasks.map((task, position) => ({
            templateId: template.id,
            userId,
            title: task.title,
            startMinute: task.startMinute,
            durationMinutes: task.durationMinutes,
            priority: task.priority,
            categoryId: task.categoryId,
            position,
          })),
        })
      })
      return readTemplates(userId)
    },

    async appliedTemplateIds(userId, date) {
      const rows = await db.dayTemplateApplication.findMany({
        where: { userId, appliedOn: toDayDate(date) },
        select: { templateId: true },
      })
      return rows.map((row) => row.templateId)
    },
  }
}

function toTaskDto(row: TaskRow): TaskDto {
  return {
    id: row.id,
    scheduledOn: fromDayDate(row.scheduledOn),
    startMinute: row.startMinute,
    durationMinutes: row.durationMinutes,
    title: row.title,
    description: row.description,
    priority: row.priority,
    outcome: row.outcome,
    completedAt: row.completedAt?.toISOString() ?? null,
    movedFrom: row.movedFrom ? fromDayDate(row.movedFrom) : null,
    colorOverride: row.colorOverride,
    repeat: row.series
      ? {
          seriesId: row.series.id,
          rule: ruleFromRow(row.series),
          startsOn: fromDayDate(row.series.startsOn),
          endsOn: row.series.endsOn ? fromDayDate(row.series.endsOn) : null,
        }
      : null,
    categoryId: row.categoryId,
    stepId: row.stepId,
    position: row.position,
    subtasks: row.subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      completedAt: subtask.completedAt?.toISOString() ?? null,
      position: subtask.position,
    })),
  }
}
