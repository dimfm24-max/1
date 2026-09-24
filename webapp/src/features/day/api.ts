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
  repeatTaskRequestSchema,
  resolveTaskRequestSchema,
  saveDayAsTemplateRequestSchema,
  stepPlansResponseSchema,
  taskResponseSchema,
  templatesResponseSchema,
  updateCategoryRequestSchema,
  updateSubtaskRequestSchema,
  updateTaskRequestSchema,
  updateTemplateItemRequestSchema,
  updateTemplateRequestSchema,
  type ApplyTemplateRequest,
  type CreateCategoryRequest,
  type CreateTaskRequest,
  type CreateTemplateItemRequest,
  type RepeatScope,
  type RepeatTaskRequest,
  type ResolveTaskRequest,
  type SaveDayAsTemplateRequest,
  type UpdateCategoryRequest,
  type UpdateSubtaskRequest,
  type UpdateTaskRequest,
  type UpdateTemplateItemRequest,
  type UpdateTemplateRequest,
} from '@dilife/contracts'
import { z } from 'zod'

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

export function deleteTaskInScope(
  transport: AuthenticatedTransport,
  taskId: string,
  scope: RepeatScope,
) {
  return transport.request(`/api/day/tasks/${taskId}?scope=${scope}`, dayResponseSchema, {
    method: 'DELETE',
  })
}

export function repeatTask(
  transport: AuthenticatedTransport,
  taskId: string,
  input: RepeatTaskRequest,
) {
  return transport.request(`/api/day/tasks/${taskId}/repeat`, taskResponseSchema, {
    method: 'PUT',
    body: repeatTaskRequestSchema.parse(input),
  })
}

export function stopRepeat(transport: AuthenticatedTransport, seriesId: string) {
  return transport.request(
    `/api/day/series/${seriesId}`,
    z.object({ stopped: z.literal(true) }).strict(),
    { method: 'DELETE' },
  )
}

export function fetchStepPlans(
  transport: AuthenticatedTransport,
  options?: { signal?: AbortSignal },
) {
  return transport.request('/api/day/step-plans', stepPlansResponseSchema, {
    signal: options?.signal,
  })
}

export function fetchAppliedTemplates(
  transport: AuthenticatedTransport,
  date: string,
  options?: { signal?: AbortSignal },
) {
  return transport.request(
    `/api/day/${date}/applied-templates`,
    z.object({ templateIds: z.array(z.string()) }).strict(),
    { signal: options?.signal },
  )
}

export function updateCategory(
  transport: AuthenticatedTransport,
  categoryId: string,
  input: UpdateCategoryRequest,
) {
  return transport.request(`/api/day/categories/${categoryId}`, categoriesResponseSchema, {
    method: 'PATCH',
    body: updateCategoryRequestSchema.parse(input),
  })
}

export function updateTemplate(
  transport: AuthenticatedTransport,
  templateId: string,
  input: UpdateTemplateRequest,
) {
  return transport.request(`/api/day/templates/${templateId}`, templatesResponseSchema, {
    method: 'PATCH',
    body: updateTemplateRequestSchema.parse(input),
  })
}

export function updateTemplateItem(
  transport: AuthenticatedTransport,
  itemId: string,
  input: UpdateTemplateItemRequest,
) {
  return transport.request(`/api/day/template-items/${itemId}`, templatesResponseSchema, {
    method: 'PATCH',
    body: updateTemplateItemRequestSchema.parse(input),
  })
}

export function deleteTemplateItem(transport: AuthenticatedTransport, itemId: string) {
  return transport.request(`/api/day/template-items/${itemId}`, templatesResponseSchema, {
    method: 'DELETE',
  })
}

export function saveDayAsTemplate(
  transport: AuthenticatedTransport,
  input: SaveDayAsTemplateRequest,
) {
  return transport.request('/api/day/templates/from-day', templatesResponseSchema, {
    method: 'POST',
    body: saveDayAsTemplateRequestSchema.parse(input),
  })
}
