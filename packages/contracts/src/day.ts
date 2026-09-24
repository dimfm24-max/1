import { z } from 'zod'

import { toneSchema } from './tone'

/**
 * The day: tasks, the categories that colour them, the templates a day is built from, and the
 * per-person settings the screen reads.
 *
 * A day is addressed by date, never by a moment. Moving a task to tomorrow must not depend on
 * the hour it was created, and two devices in different time zones must agree on which day a
 * task belongs to.
 */

export const TASK_TITLE_MAX = 200
export const MINUTES_IN_DAY = 24 * 60

/** `YYYY-MM-DD`. Parsed rather than trusted: a Date would drag a time zone in with it. */
export const dayDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в виде ГГГГ-ММ-ДД')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), 'Такой даты нет')

/** Minutes past midnight, so 8:30 is 510. Null means "today, no particular time". */
const startMinuteSchema = z.number().int().min(0).max(MINUTES_IN_DAY - 1).nullable()

/**
 * A task may run to the end of the day but not past it. A longer piece of work is several tasks,
 * which is also how a person would plan it.
 */
const durationSchema = z.number().int().positive().max(MINUTES_IN_DAY)

const titleSchema = z.string().trim().min(1).max(TASK_TITLE_MAX)

/** `#rrggbb`. The interface renders it directly, so the shape is checked here, not there. */
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Цвет в виде #rrggbb')

export const taskPrioritySchema = z.enum(['normal', 'important', 'urgent'])

/**
 * `burned` is a choice, not a failure the app decides: at the end of a day a person says whether
 * an unfinished task moves or is let go, and the history keeps the answer.
 */
export const taskOutcomeSchema = z.enum(['planned', 'done', 'burned'])

export const taskCategorySchema = z.object({
  id: z.string(),
  title: z.string(),
  color: z.string(),
  position: z.number().int().nonnegative(),
  /** What uses the category, so deleting it can say how much loses its colour (task 14). */
  usage: z
    .object({ tasks: z.number().int().nonnegative(), templateItems: z.number().int().nonnegative() })
    .optional(),
})

/**
 * How a repeating task or a template picks its days (tasks 17 and 18). Weekdays count 0-6 from
 * Sunday, as habits do; the 29th-31st fall on the last day of a shorter month.
 */
export const scheduleRuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('daily') }).strict(),
  z
    .object({
      kind: z.literal('weekdays'),
      weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    })
    .strict(),
  z
    .object({
      kind: z.literal('monthdays'),
      monthDays: z.array(z.number().int().min(1).max(31)).min(1).max(31),
    })
    .strict(),
  z
    .object({
      kind: z.literal('dates'),
      dates: z.array(dayDateSchema).min(1).max(366),
    })
    .strict(),
])

/** The repeat a task belongs to, shown and changed from its card. */
export const taskRepeatSchema = z.object({
  seriesId: z.string(),
  rule: scheduleRuleSchema,
  startsOn: z.string(),
  endsOn: z.string().nullable(),
})

export const subtaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  completedAt: z.string().datetime().nullable(),
  position: z.number().int().nonnegative(),
})

export const taskSchema = z.object({
  id: z.string(),
  scheduledOn: z.string(),
  startMinute: z.number().int().nullable(),
  durationMinutes: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
  priority: taskPrioritySchema,
  outcome: taskOutcomeSchema,
  completedAt: z.string().datetime().nullable(),
  movedFrom: z.string().nullable(),
  colorOverride: z.string().nullable(),
  /** Set when the task is one occurrence of a repeat (task 18). */
  repeat: taskRepeatSchema.nullable().optional(),
  categoryId: z.string().nullable(),
  stepId: z.string().nullable(),
  position: z.number().int().nonnegative(),
  subtasks: z.array(subtaskSchema),
})

/** The age the life horizon counts to until the person names another (§5 of PRD.md). */
export const DEFAULT_LIFE_EXPECTANCY_YEARS = 80

export const userSettingsSchema = z.object({
  dayStartMinute: z.number().int().min(0).max(MINUTES_IN_DAY - 1),
  defaultTaskMinutes: z.number().int().positive().max(MINUTES_IN_DAY),
  tone: toneSchema,
  birthDate: z.string().nullable(),
  lifeExpectancy: z.number().int().positive().nullable(),
  /**
   * IANA name such as `Europe/Moscow`, or null until the browser has reported one. Optional in
   * the schema so a client never breaks on a response from an older server.
   */
  timeZone: z.string().nullable().optional(),
})

export const dayTemplateItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  startMinute: z.number().int().nullable(),
  durationMinutes: z.number().int(),
  priority: taskPrioritySchema,
  categoryId: z.string().nullable(),
  position: z.number().int().nonnegative(),
})

export const dayTemplateSchema = z.object({
  id: z.string(),
  title: z.string(),
  position: z.number().int().nonnegative(),
  items: z.array(dayTemplateItemSchema),
  /** Applied by itself on the days the rule picks; null means by hand only (task 17). */
  rule: scheduleRuleSchema.nullable().optional(),
})

export const dayResponseSchema = z
  .object({
    date: z.string(),
    tasks: z.array(taskSchema),
  })
  .strict()

export const dayContextResponseSchema = z
  .object({
    settings: userSettingsSchema,
    categories: z.array(taskCategorySchema),
    templates: z.array(dayTemplateSchema),
  })
  .strict()

export const taskResponseSchema = z.object({ task: taskSchema }).strict()

export const createTaskRequestSchema = z
  .object({
    scheduledOn: dayDateSchema,
    title: titleSchema,
    description: z.union([z.string().trim().min(1), z.null()]).optional(),
    startMinute: startMinuteSchema.optional(),
    durationMinutes: durationSchema.optional(),
    priority: taskPrioritySchema.default('normal'),
    categoryId: z.union([z.uuid(), z.null()]).optional(),
    stepId: z.union([z.uuid(), z.null()]).optional(),
    colorOverride: z.union([colorSchema, z.null()]).optional(),
  })
  .strict()

/** Which occurrences of a repeat a change or a deletion reaches (task 18). */
export const repeatScopeSchema = z.enum(['this', 'following'])

export const updateTaskRequestSchema = z
  .object({
    /** A new day for the task, picked in its card or by dragging in the calendar. */
    scheduledOn: dayDateSchema.optional(),
    /** For an occurrence of a repeat: only this one, or this and the following ones. */
    scope: repeatScopeSchema.optional(),
    title: titleSchema.optional(),
    description: z.union([z.string().trim().min(1), z.null()]).optional(),
    startMinute: startMinuteSchema.optional(),
    durationMinutes: durationSchema.optional(),
    priority: taskPrioritySchema.optional(),
    categoryId: z.union([z.uuid(), z.null()]).optional(),
    stepId: z.union([z.uuid(), z.null()]).optional(),
    colorOverride: z.union([colorSchema, z.null()]).optional(),
    isCompleted: z.boolean().optional(),
  })
  .strict()

/** Makes a task repeat: it becomes the first occurrence, the next ones follow the rule. */
export const repeatTaskRequestSchema = z
  .object({
    rule: scheduleRuleSchema,
    /** The last day it repeats on; null or absent repeats without end. */
    endsOn: z.union([dayDateSchema, z.null()]).optional(),
  })
  .strict()

export const deleteTaskQuerySchema = z
  .object({
    scope: repeatScopeSchema.optional(),
  })
  .strict()

/** A step of a goal already in a plan, so the step list can say «в плане на 23.09.2026». */
export const stepPlanSchema = z.object({
  stepId: z.string(),
  scheduledOn: z.string(),
})

export const stepPlansResponseSchema = z
  .object({
    plans: z.array(stepPlanSchema),
  })
  .strict()

/**
 * Closing an unfinished task. `move` carries the day it goes to, so "tomorrow" is decided by the
 * client that knows the person's time zone rather than guessed by the server.
 */
export const resolveTaskRequestSchema = z
  .discriminatedUnion('action', [
    z.object({ action: z.literal('burn') }).strict(),
    z.object({ action: z.literal('move'), scheduledOn: dayDateSchema }).strict(),
  ])

export const createSubtaskRequestSchema = z.object({ title: titleSchema }).strict()

export const updateSubtaskRequestSchema = z
  .object({
    title: titleSchema.optional(),
    isCompleted: z.boolean().optional(),
  })
  .strict()

export const updateSettingsRequestSchema = z
  .object({
    dayStartMinute: z.number().int().min(0).max(MINUTES_IN_DAY - 1).optional(),
    defaultTaskMinutes: durationSchema.optional(),
    tone: userSettingsSchema.shape.tone.optional(),
    birthDate: z.union([dayDateSchema, z.null()]).optional(),
    lifeExpectancy: z.union([z.number().int().positive().max(150), z.null()]).optional(),
    /** Checked against the server's time zone database; an unknown name is refused. */
    timeZone: z.string().trim().min(1).max(64).optional(),
  })
  .strict()

export const settingsResponseSchema = z.object({ settings: userSettingsSchema }).strict()

export const createCategoryRequestSchema = z
  .object({
    title: titleSchema,
    color: colorSchema,
  })
  .strict()

export const updateCategoryRequestSchema = z
  .object({
    title: titleSchema.optional(),
    color: colorSchema.optional(),
  })
  .strict()

export const categoriesResponseSchema = z
  .object({ categories: z.array(taskCategorySchema) })
  .strict()

export const createTemplateRequestSchema = z.object({ title: titleSchema }).strict()

export const updateTemplateRequestSchema = z
  .object({
    title: titleSchema.optional(),
    /** Null goes back to applying by hand. */
    rule: z.union([scheduleRuleSchema, z.null()]).optional(),
  })
  .strict()

export const updateTemplateItemRequestSchema = z
  .object({
    title: titleSchema.optional(),
    startMinute: startMinuteSchema.optional(),
    durationMinutes: durationSchema.optional(),
    priority: taskPrioritySchema.optional(),
    categoryId: z.union([z.uuid(), z.null()]).optional(),
  })
  .strict()

/** «Сохранить день как шаблон»: the day's tasks become the items of a new template. */
export const saveDayAsTemplateRequestSchema = z
  .object({
    title: titleSchema,
    date: dayDateSchema,
  })
  .strict()

export const createTemplateItemRequestSchema = z
  .object({
    title: titleSchema,
    startMinute: startMinuteSchema.optional(),
    durationMinutes: durationSchema.optional(),
    priority: taskPrioritySchema.default('normal'),
    categoryId: z.union([z.uuid(), z.null()]).optional(),
  })
  .strict()

export const applyTemplateRequestSchema = z
  .object({
    templateId: z.uuid(),
    scheduledOn: dayDateSchema,
  })
  .strict()

export const templatesResponseSchema = z
  .object({ templates: z.array(dayTemplateSchema) })
  .strict()

export const dayParamsSchema = z.object({ date: dayDateSchema }).strict()
export const taskIdParamsSchema = z.object({ taskId: z.uuid() }).strict()
export const subtaskIdParamsSchema = z.object({ subtaskId: z.uuid() }).strict()
export const categoryIdParamsSchema = z.object({ categoryId: z.uuid() }).strict()
export const templateIdParamsSchema = z.object({ templateId: z.uuid() }).strict()
export const templateItemIdParamsSchema = z.object({ itemId: z.uuid() }).strict()
export const seriesIdParamsSchema = z.object({ seriesId: z.uuid() }).strict()

export type TaskPriority = z.infer<typeof taskPrioritySchema>
export type TaskOutcome = z.infer<typeof taskOutcomeSchema>
export type TaskDto = z.infer<typeof taskSchema>
export type SubtaskDto = z.infer<typeof subtaskSchema>
export type TaskCategoryDto = z.infer<typeof taskCategorySchema>
export type DayTemplateDto = z.infer<typeof dayTemplateSchema>
export type DayTemplateItemDto = z.infer<typeof dayTemplateItemSchema>
export type UserSettingsDto = z.infer<typeof userSettingsSchema>
export type DayResponse = z.infer<typeof dayResponseSchema>
export type DayContextResponse = z.infer<typeof dayContextResponseSchema>
export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>
export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>
export type ResolveTaskRequest = z.infer<typeof resolveTaskRequestSchema>
export type CreateSubtaskRequest = z.infer<typeof createSubtaskRequestSchema>
export type UpdateSubtaskRequest = z.infer<typeof updateSubtaskRequestSchema>
export type UpdateSettingsRequest = z.infer<typeof updateSettingsRequestSchema>
export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>
export type UpdateCategoryRequest = z.infer<typeof updateCategoryRequestSchema>
export type CreateTemplateRequest = z.infer<typeof createTemplateRequestSchema>
export type CreateTemplateItemRequest = z.infer<typeof createTemplateItemRequestSchema>
export type ApplyTemplateRequest = z.infer<typeof applyTemplateRequestSchema>
export type ScheduleRuleDto = z.infer<typeof scheduleRuleSchema>
export type TaskRepeatDto = z.infer<typeof taskRepeatSchema>
export type RepeatScope = z.infer<typeof repeatScopeSchema>
export type RepeatTaskRequest = z.infer<typeof repeatTaskRequestSchema>
export type StepPlanDto = z.infer<typeof stepPlanSchema>
export type StepPlansResponse = z.infer<typeof stepPlansResponseSchema>
export type UpdateTemplateRequest = z.infer<typeof updateTemplateRequestSchema>
export type UpdateTemplateItemRequest = z.infer<typeof updateTemplateItemRequestSchema>
export type SaveDayAsTemplateRequest = z.infer<typeof saveDayAsTemplateRequestSchema>
