import {
  applyTemplateRequestSchema,
  categoriesResponseSchema,
  createCategoryRequestSchema,
  createSubtaskRequestSchema,
  createTaskRequestSchema,
  createTemplateItemRequestSchema,
  createTemplateRequestSchema,
  dayContextResponseSchema,
  dayResponseSchema,
  resolveTaskRequestSchema,
  settingsResponseSchema,
  taskResponseSchema,
  templatesResponseSchema,
  updateSettingsRequestSchema,
  updateSubtaskRequestSchema,
  updateTaskRequestSchema,
  type ApplyTemplateRequest,
  type CreateCategoryRequest,
  type CreateTaskRequest,
  type CreateTemplateItemRequest,
  type ResolveTaskRequest,
  type UpdateSettingsRequest,
  type UpdateSubtaskRequest,
  type UpdateTaskRequest,
} from '@dilife/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

export function fetchDay(
  transport: AuthenticatedTransport,
  date: string,
  options?: { signal?: AbortSignal },
) {
  return transport.request(`/api/day/${date}`, dayResponseSchema, { signal: options?.signal })
}

export function fetchDayContext(
  transport: AuthenticatedTransport,
  options?: { signal?: AbortSignal },
) {
  return transport.request('/api/day/context', dayContextResponseSchema, {
    signal: options?.signal,
  })
}

export function createTask(transport: AuthenticatedTransport, input: CreateTaskRequest) {
  return transport.request('/api/day/tasks', taskResponseSchema, {
    method: 'POST',
    body: createTaskRequestSchema.parse(input),
  })
}

export function updateTask(
  transport: AuthenticatedTransport,
  taskId: string,
  input: UpdateTaskRequest,
) {
  return transport.request(`/api/day/tasks/${taskId}`, taskResponseSchema, {
    method: 'PATCH',
    body: updateTaskRequestSchema.parse(input),
  })
}

export function resolveTask(
  transport: AuthenticatedTransport,
  taskId: string,
  input: ResolveTaskRequest,
) {
  return transport.request(`/api/day/tasks/${taskId}/resolve`, taskResponseSchema, {
    method: 'POST',
    body: resolveTaskRequestSchema.parse(input),
  })
}

export function deleteTask(transport: AuthenticatedTransport, taskId: string) {
  return transport.request(`/api/day/tasks/${taskId}`, dayResponseSchema, { method: 'DELETE' })
}

export function createSubtask(
  transport: AuthenticatedTransport,
  taskId: string,
  title: string,
) {
  return transport.request(`/api/day/tasks/${taskId}/subtasks`, taskResponseSchema, {
    method: 'POST',
    body: createSubtaskRequestSchema.parse({ title }),
  })
}

export function updateSubtask(
  transport: AuthenticatedTransport,
  subtaskId: string,
  input: UpdateSubtaskRequest,
) {
  return transport.request(`/api/day/subtasks/${subtaskId}`, taskResponseSchema, {
    method: 'PATCH',
    body: updateSubtaskRequestSchema.parse(input),
  })
}

export function deleteSubtask(transport: AuthenticatedTransport, subtaskId: string) {
  return transport.request(`/api/day/subtasks/${subtaskId}`, taskResponseSchema, {
    method: 'DELETE',
  })
}

export function updateSettings(
  transport: AuthenticatedTransport,
  input: UpdateSettingsRequest,
) {
  return transport.request('/api/day/settings', settingsResponseSchema, {
    method: 'PATCH',
    body: updateSettingsRequestSchema.parse(input),
  })
}

export function createCategory(
  transport: AuthenticatedTransport,
  input: CreateCategoryRequest,
) {
  return transport.request('/api/day/categories', categoriesResponseSchema, {
    method: 'POST',
    body: createCategoryRequestSchema.parse(input),
  })
}

export function deleteCategory(transport: AuthenticatedTransport, categoryId: string) {
  return transport.request(`/api/day/categories/${categoryId}`, categoriesResponseSchema, {
    method: 'DELETE',
  })
}

export function createTemplate(transport: AuthenticatedTransport, title: string) {
  return transport.request('/api/day/templates', templatesResponseSchema, {
    method: 'POST',
    body: createTemplateRequestSchema.parse({ title }),
  })
}

export function deleteTemplate(transport: AuthenticatedTransport, templateId: string) {
  return transport.request(`/api/day/templates/${templateId}`, templatesResponseSchema, {
    method: 'DELETE',
  })
}

export function createTemplateItem(
  transport: AuthenticatedTransport,
  templateId: string,
  input: CreateTemplateItemRequest,
) {
  return transport.request(`/api/day/templates/${templateId}/items`, templatesResponseSchema, {
    method: 'POST',
    body: createTemplateItemRequestSchema.parse(input),
  })
}

export function applyTemplate(transport: AuthenticatedTransport, input: ApplyTemplateRequest) {
  return transport.request('/api/day/templates/apply', dayResponseSchema, {
    method: 'POST',
    body: applyTemplateRequestSchema.parse(input),
  })
}
