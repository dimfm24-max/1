import type {
  ApplyTemplateRequest,
  CreateCategoryRequest,
  CreateSubtaskRequest,
  CreateTaskRequest,
  CreateTemplateItemRequest,
  CreateTemplateRequest,
  DayTemplateDto,
  TaskCategoryDto,
  TaskDto,
  UpdateCategoryRequest,
  UpdateSettingsRequest,
  UpdateSubtaskRequest,
  UpdateTaskRequest,
  UserSettingsDto,
} from '@dilife/contracts'

import type { DbClient } from '../../../db'
import type { DayRepository } from '../application/ports'
import { DayFailure } from '../domain/errors'

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
  subtasks: {
    orderBy: { position: 'asc' },
    select: { id: true, title: true, completedAt: true, position: true },
  },
} as const

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

export function createPrismaDayRepository(db: DbClient): DayRepository {
  async function settingsFor(userId: string): Promise<UserSettingsDto> {
    // Created on first read rather than at registration: a row that exists only once someone
    // opens the day screen cannot go missing for accounts made before this feature existed.
    const settings = await db.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: {
        dayStartMinute: true,
        defaultTaskMinutes: true,
        tone: true,
        birthDate: true,
        lifeExpectancy: true,
      },
    })
    return {
      dayStartMinute: settings.dayStartMinute,
      defaultTaskMinutes: settings.defaultTaskMinutes,
      tone: settings.tone as UserSettingsDto['tone'],
      birthDate: settings.birthDate ? fromDayDate(settings.birthDate) : null,
      lifeExpectancy: settings.lifeExpectancy,
    }
  }

  async function readDay(userId: string, date: string) {
    const tasks = await db.task.findMany({
      where: { userId, scheduledOn: toDayDate(date) },
      orderBy: [{ startMinute: 'asc' }, { position: 'asc' }],
      select: taskSelect,
    })
    return { date, tasks: tasks.map((task) => toTaskDto(task as TaskRow)) }
  }

  async function taskOrFail(userId: string, taskId: string) {
    const task = await db.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true, outcome: true, completedAt: true, scheduledOn: true },
    })
    if (!task) throw new DayFailure('not_found', 'Task not found')
    return task
  }

  async function readTask(userId: string, taskId: string): Promise<TaskDto> {
    const task = await db.task.findFirst({ where: { id: taskId, userId }, select: taskSelect })
    if (!task) throw new DayFailure('not_found', 'Task not found')
    return toTaskDto(task as TaskRow)
  }

  async function readCategories(userId: string): Promise<TaskCategoryDto[]> {
    const categories = await db.taskCategory.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
      select: { id: true, title: true, color: true, position: true },
    })
    return categories
  }

  async function readTemplates(userId: string): Promise<DayTemplateDto[]> {
    const templates = await db.dayTemplate.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        title: true,
        position: true,
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
    return templates
  }

  async function nextPosition(
    table: 'task' | 'taskSubtask' | 'taskCategory' | 'dayTemplate' | 'dayTemplateItem',
    where: Record<string, unknown>,
  ) {
    const last = await (db[table] as {
      findFirst(args: unknown): Promise<{ position: number } | null>
    }).findFirst({ where, orderBy: { position: 'desc' }, select: { position: true } })
    return (last?.position ?? -1) + 1
  }

  async function subtaskOrFail(userId: string, subtaskId: string) {
    const subtask = await db.taskSubtask.findFirst({
      where: { id: subtaskId, userId },
      select: { id: true, taskId: true, completedAt: true },
    })
    if (!subtask) throw new DayFailure('not_found', 'Subtask not found')
    return subtask
  }

  return {
    settingsFor,
    readDay,

    async readContext(userId) {
      return {
        settings: await settingsFor(userId),
        categories: await readCategories(userId),
        templates: await readTemplates(userId),
      }
    },

    async createTask(userId, input: CreateTaskRequest, defaultMinutes) {
      const scheduledOn = toDayDate(input.scheduledOn)
      const created = await db.task.create({
        data: {
          userId,
          scheduledOn,
          title: input.title,
          description: input.description ?? null,
          startMinute: input.startMinute ?? null,
          durationMinutes: input.durationMinutes ?? defaultMinutes,
          priority: input.priority,
          categoryId: input.categoryId ?? null,
          // A step is addressed by id, and the owner filter on the lookup is what keeps a task
          // from pointing at someone else's goal.
          stepId: await ownedStepId(userId, input.stepId ?? null),
          colorOverride: input.colorOverride ?? null,
          position: await nextPosition('task', { userId, scheduledOn }),
        },
        select: taskSelect,
      })
      return toTaskDto(created as TaskRow)
    },

    async updateTask(userId, taskId, input: UpdateTaskRequest, now) {
      const task = await taskOrFail(userId, taskId)
      await db.task.update({
        where: { id: taskId },
        data: {
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.startMinute === undefined ? {} : { startMinute: input.startMinute }),
          ...(input.durationMinutes === undefined
            ? {}
            : { durationMinutes: input.durationMinutes }),
          ...(input.priority === undefined ? {} : { priority: input.priority }),
          ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
          ...(input.stepId === undefined
            ? {}
            : { stepId: await ownedStepId(userId, input.stepId) }),
          ...(input.colorOverride === undefined ? {} : { colorOverride: input.colorOverride }),
          // Completing keeps the moment it was first done, so a stray tap cannot rewrite the
          // day something happened. Un-completing returns the task to the plan.
          ...(input.isCompleted === undefined
            ? {}
            : input.isCompleted
              ? { outcome: 'done' as const, completedAt: task.completedAt ?? now }
              : { outcome: 'planned' as const, completedAt: null }),
        },
      })
      return readTask(userId, taskId)
    },

    async resolveTask(userId, taskId, input) {
      const task = await taskOrFail(userId, taskId)
      if (task.outcome === 'done') {
        throw new DayFailure('task_already_resolved', 'This task is already done')
      }
      if (input.action === 'burn') {
        await db.task.update({ where: { id: taskId }, data: { outcome: 'burned' } })
        return readTask(userId, taskId)
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
          position: await nextPosition('task', { userId, scheduledOn }),
        },
      })
      return readTask(userId, taskId)
    },

    async deleteTask(userId, taskId) {
      const deleted = await db.task.deleteMany({ where: { id: taskId, userId } })
      if (deleted.count === 0) throw new DayFailure('not_found', 'Task not found')
    },

    async createSubtask(userId, taskId, input: CreateSubtaskRequest) {
      await taskOrFail(userId, taskId)
      await db.taskSubtask.create({
        data: {
          taskId,
          userId,
          title: input.title,
          position: await nextPosition('taskSubtask', { taskId }),
        },
      })
      return readTask(userId, taskId)
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
      return readTask(userId, subtask.taskId)
    },

    async deleteSubtask(userId, subtaskId) {
      const subtask = await subtaskOrFail(userId, subtaskId)
      await db.taskSubtask.delete({ where: { id: subtaskId } })
      return readTask(userId, subtask.taskId)
    },

    async updateSettings(userId, input: UpdateSettingsRequest) {
      await settingsFor(userId)
      await db.userSettings.update({
        where: { userId },
        data: {
          ...(input.dayStartMinute === undefined ? {} : { dayStartMinute: input.dayStartMinute }),
          ...(input.defaultTaskMinutes === undefined
            ? {}
            : { defaultTaskMinutes: input.defaultTaskMinutes }),
          ...(input.tone === undefined ? {} : { tone: input.tone }),
          ...(input.birthDate === undefined
            ? {}
            : { birthDate: input.birthDate === null ? null : toDayDate(input.birthDate) }),
          ...(input.lifeExpectancy === undefined
            ? {}
            : { lifeExpectancy: input.lifeExpectancy }),
        },
      })
      return settingsFor(userId)
    },

    async createCategory(userId, input: CreateCategoryRequest) {
      await db.taskCategory.create({
        data: {
          userId,
          title: input.title,
          color: input.color,
          position: await nextPosition('taskCategory', { userId }),
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
      // not delete work filed under it.
      const deleted = await db.taskCategory.deleteMany({ where: { id: categoryId, userId } })
      if (deleted.count === 0) throw new DayFailure('not_found', 'Category not found')
      return readCategories(userId)
    },

    async createTemplate(userId, input: CreateTemplateRequest) {
      await db.dayTemplate.create({
        data: {
          userId,
          title: input.title,
          position: await nextPosition('dayTemplate', { userId }),
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
          categoryId: input.categoryId ?? null,
          position: await nextPosition('dayTemplateItem', { templateId }),
        },
      })
      return readTemplates(userId)
    },

    async deleteTemplateItem(userId, itemId) {
      const deleted = await db.dayTemplateItem.deleteMany({ where: { id: itemId, userId } })
      if (deleted.count === 0) throw new DayFailure('not_found', 'Template item not found')
      return readTemplates(userId)
    },

    async applyTemplate(userId, input: ApplyTemplateRequest) {
      const template = await db.dayTemplate.findFirst({
        where: { id: input.templateId, userId },
        select: {
          items: {
            orderBy: { position: 'asc' },
            select: {
              title: true,
              startMinute: true,
              durationMinutes: true,
              priority: true,
              categoryId: true,
            },
          },
        },
      })
      if (!template) throw new DayFailure('not_found', 'Template not found')

      const scheduledOn = toDayDate(input.scheduledOn)
      // Added to the day rather than replacing it: a person applying a template to a day that
      // already has work in it means "and also this", not "instead of that".
      let position = await nextPosition('task', { userId, scheduledOn })
      for (const item of template.items) {
        await db.task.create({
          data: {
            userId,
            scheduledOn,
            title: item.title,
            startMinute: item.startMinute,
            durationMinutes: item.durationMinutes,
            priority: item.priority,
            categoryId: item.categoryId,
            position,
          },
        })
        position += 1
      }
      return readDay(userId, input.scheduledOn)
    },
  }

  /** A step id is accepted only when it belongs to this person; anything else becomes null. */
  async function ownedStepId(userId: string, stepId: string | null) {
    if (stepId === null) return null
    const step = await db.goalStep.findFirst({
      where: { id: stepId, userId },
      select: { id: true },
    })
    if (!step) throw new DayFailure('not_found', 'Step not found')
    return step.id
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
