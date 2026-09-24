import type {
  ApplyTemplateRequest,
  CreateCategoryRequest,
  CreateSubtaskRequest,
  CreateTaskRequest,
  CreateTemplateItemRequest,
  CreateTemplateRequest,
  DayContextResponse,
  DayResponse,
  DayTemplateDto,
  RepeatScope,
  RepeatTaskRequest,
  ResolveTaskRequest,
  SaveDayAsTemplateRequest,
  StepPlanDto,
  TaskCategoryDto,
  TaskDto,
  UpdateCategoryRequest,
  UpdateSubtaskRequest,
  UpdateTaskRequest,
  UpdateTemplateItemRequest,
  UpdateTemplateRequest,
} from '@dilife/contracts'

/**
 * Every port takes the owner id and the repository filters on it inside the query that finds the
 * row, so another person's task is not found rather than found and then refused.
 */
export type DayRepository = {
  /** The day's tasks, in the order of the person's own day (tasks 02 and 15). */
  readDay(userId: string, date: string, dayStartMinute: number): Promise<DayResponse>
  /** Makes the day's repeat occurrences and scheduled templates that are still missing. */
  materializeDay(userId: string, date: string): Promise<void>
  /** Categories and templates; the settings in the context come from the settings module. */
  readContext(userId: string, now: Date): Promise<Omit<DayContextResponse, 'settings'>>

  createTask(userId: string, input: CreateTaskRequest, defaultMinutes: number): Promise<TaskDto>
  updateTask(
    userId: string,
    taskId: string,
    input: UpdateTaskRequest,
    now: Date,
  ): Promise<TaskDto>
  /** Makes the task repeat, or changes its repeat; `today` is the person's day. */
  repeatTask(
    userId: string,
    taskId: string,
    input: RepeatTaskRequest,
    today: string,
    now: Date,
  ): Promise<TaskDto>
  /** The repeat ends today; later untouched occurrences go to the trash. */
  stopRepeat(userId: string, seriesId: string, today: string, now: Date): Promise<void>
  resolveTask(userId: string, taskId: string, input: ResolveTaskRequest): Promise<TaskDto>
  /** Sends the task to the trash; for a repeat, only it or it and the following ones. */
  deleteTask(
    userId: string,
    taskId: string,
    now: Date,
    scope: RepeatScope | undefined,
    dayStartMinute: number,
  ): Promise<DayResponse>

  createSubtask(userId: string, taskId: string, input: CreateSubtaskRequest): Promise<TaskDto>
  updateSubtask(
    userId: string,
    subtaskId: string,
    input: UpdateSubtaskRequest,
    now: Date,
  ): Promise<TaskDto>
  deleteSubtask(userId: string, subtaskId: string): Promise<TaskDto>

  /** Goal steps already planned from `from` on, for «в плане на …» (task 16). */
  readStepPlans(userId: string, from: string): Promise<StepPlanDto[]>

  createCategory(userId: string, input: CreateCategoryRequest): Promise<TaskCategoryDto[]>
  updateCategory(
    userId: string,
    categoryId: string,
    input: UpdateCategoryRequest,
  ): Promise<TaskCategoryDto[]>
  deleteCategory(userId: string, categoryId: string): Promise<TaskCategoryDto[]>

  createTemplate(userId: string, input: CreateTemplateRequest): Promise<DayTemplateDto[]>
  updateTemplate(
    userId: string,
    templateId: string,
    input: UpdateTemplateRequest,
    today: string,
  ): Promise<DayTemplateDto[]>
  deleteTemplate(userId: string, templateId: string): Promise<DayTemplateDto[]>
  createTemplateItem(
    userId: string,
    templateId: string,
    input: CreateTemplateItemRequest,
    defaultMinutes: number,
  ): Promise<DayTemplateDto[]>
  updateTemplateItem(
    userId: string,
    itemId: string,
    input: UpdateTemplateItemRequest,
  ): Promise<DayTemplateDto[]>
  deleteTemplateItem(userId: string, itemId: string): Promise<DayTemplateDto[]>
  applyTemplate(
    userId: string,
    input: ApplyTemplateRequest,
    dayStartMinute: number,
  ): Promise<DayResponse>
  saveDayAsTemplate(userId: string, input: SaveDayAsTemplateRequest): Promise<DayTemplateDto[]>
  /** Templates already applied to a day, so applying one twice can be warned about. */
  appliedTemplateIds(userId: string, date: string): Promise<string[]>
}

export type Clock = {
  now(): Date
}
