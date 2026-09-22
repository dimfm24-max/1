import type {
  ApplyTemplateRequest,
  CreateCategoryRequest,
  CreateSubtaskRequest,
  CreateTaskRequest,
  CreateTemplateItemRequest,
  CreateTemplateRequest,
  DayContextResponse,
  DayResponse,
  ResolveTaskRequest,
  TaskCategoryDto,
  TaskDto,
  UpdateCategoryRequest,
  UpdateSettingsRequest,
  UpdateSubtaskRequest,
  UpdateTaskRequest,
  UserSettingsDto,
  DayTemplateDto,
} from '@dilife/contracts'

/**
 * Every port takes the owner id and the repository filters on it inside the query that finds the
 * row, so another person's task is not found rather than found and then refused.
 */
export type DayRepository = {
  readDay(userId: string, date: string): Promise<DayResponse>
  readContext(userId: string): Promise<DayContextResponse>

  createTask(userId: string, input: CreateTaskRequest, defaultMinutes: number): Promise<TaskDto>
  updateTask(
    userId: string,
    taskId: string,
    input: UpdateTaskRequest,
    now: Date,
  ): Promise<TaskDto>
  resolveTask(userId: string, taskId: string, input: ResolveTaskRequest): Promise<TaskDto>
  deleteTask(userId: string, taskId: string): Promise<DayResponse>

  createSubtask(userId: string, taskId: string, input: CreateSubtaskRequest): Promise<TaskDto>
  updateSubtask(
    userId: string,
    subtaskId: string,
    input: UpdateSubtaskRequest,
    now: Date,
  ): Promise<TaskDto>
  deleteSubtask(userId: string, subtaskId: string): Promise<TaskDto>

  updateSettings(userId: string, input: UpdateSettingsRequest): Promise<UserSettingsDto>

  createCategory(userId: string, input: CreateCategoryRequest): Promise<TaskCategoryDto[]>
  updateCategory(
    userId: string,
    categoryId: string,
    input: UpdateCategoryRequest,
  ): Promise<TaskCategoryDto[]>
  deleteCategory(userId: string, categoryId: string): Promise<TaskCategoryDto[]>

  createTemplate(userId: string, input: CreateTemplateRequest): Promise<DayTemplateDto[]>
  deleteTemplate(userId: string, templateId: string): Promise<DayTemplateDto[]>
  createTemplateItem(
    userId: string,
    templateId: string,
    input: CreateTemplateItemRequest,
    defaultMinutes: number,
  ): Promise<DayTemplateDto[]>
  deleteTemplateItem(userId: string, itemId: string): Promise<DayTemplateDto[]>
  applyTemplate(userId: string, input: ApplyTemplateRequest): Promise<DayResponse>

  settingsFor(userId: string): Promise<UserSettingsDto>
}

export type Clock = {
  now(): Date
}
