import { z } from 'zod'

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
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), 'Not a real date')

/** Minutes past midnight, so 8:30 is 510. Null means "today, no particular time". */
const startMinuteSchema = z.number().int().min(0).max(MINUTES_IN_DAY - 1).nullable()

/**
 * A task may run to the end of the day but not past it. A longer piece of work is several tasks,
 * which is also how a person would plan it.
 */
const durationSchema = z.number().int().positive().max(MINUTES_IN_DAY)

const titleSchema = z.string().trim().min(1).max(TASK_TITLE_MAX)

/** `#rrggbb`. The interface renders it directly, so the shape is checked here, not there. */
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #rrggbb colour')

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
  categoryId: z.string().nullable(),
  stepId: z.string().nullable(),
  position: z.number().int().nonnegative(),
  subtasks: z.array(subtaskSchema),
})

export const userSettingsSchema = z.object({
  dayStartMinute: z.number().int().min(0).max(MINUTES_IN_DAY - 1),
  defaultTaskMinutes: z.number().int().positive().max(MINUTES_IN_DAY),
  tone: z.enum(['friendly', 'pushing', 'respectful', 'neutral']),
  birthDate: z.string().nullable(),
  lifeExpectancy: z.number().int().positive().nullable(),
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

export const updateTaskRequestSchema = z
  .object({
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
