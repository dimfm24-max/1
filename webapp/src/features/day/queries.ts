import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateTaskRequest,
  DayContextResponse,
  DayResponse,
  ResolveTaskRequest,
  TaskDto,
  UpdateSettingsRequest,
  UpdateSubtaskRequest,
  UpdateTaskRequest,
} from '@dilife/contracts'

import { sessionQueryKeys, useAuth } from '@/features/auth'
import type { AuthenticatedTransport } from '@/platform/api'
import {
  applyTemplate,
  createCategory,
  createSubtask,
  createTask,
  createTemplate,
  createTemplateItem,
  deleteCategory,
  deleteSubtask,
  deleteTask,
  deleteTemplate,
  fetchDay,
  fetchDayContext,
  resolveTask,
  updateSettings,
  updateSubtask,
  updateTask,
} from './api'

// Session-scoped, so signing out drops one account's plan instead of showing it to the next.
export const dayQueryKeys = {
  all: [...sessionQueryKeys.all, 'day'] as const,
  day: (date: string) => [...sessionQueryKeys.all, 'day', 'date', date] as const,
  context: () => [...sessionQueryKeys.all, 'day', 'context'] as const,
}

export function dayQueryOptions(transport: AuthenticatedTransport, date: string) {
  return queryOptions({
    queryKey: dayQueryKeys.day(date),
    queryFn: ({ signal }) => fetchDay(transport, date, { signal }),
  })
}

export function dayContextQueryOptions(transport: AuthenticatedTransport) {
  return queryOptions({
    queryKey: dayQueryKeys.context(),
    queryFn: ({ signal }) => fetchDayContext(transport, { signal }),
  })
}

export function useDayQuery(date: string) {
  const auth = useAuth()

  return useQuery(dayQueryOptions(auth.transport, date))
}

export function useDayContextQuery() {
  const auth = useAuth()

  return useQuery(dayContextQueryOptions(auth.transport))
}

/**
 * A task write answers with that task. It is patched into the day it belongs to - which is read
 * off the response, not assumed - because resolving a task can move it to another date, and the
 * day it left has to lose it in the same update.
 */
function useTaskMutation<TVariables>(
  mutationFn: (
    transport: AuthenticatedTransport,
    variables: TVariables,
  ) => Promise<{ task: TaskDto }>,
) {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: TVariables) => mutationFn(auth.transport, variables),
    onSuccess: (response) => {
      const task = response.task
      queryClient.setQueriesData<DayResponse>({ queryKey: dayQueryKeys.all }, (current) => {
        if (!current || !('tasks' in current)) return current
        const withoutTask = current.tasks.filter((existing) => existing.id !== task.id)
        if (current.date !== task.scheduledOn) {
          // It left this day: drop it here, and let the day it moved to refetch when opened.
          return withoutTask.length === current.tasks.length
            ? current
            : { ...current, tasks: withoutTask }
        }
        return { ...current, tasks: sortTasks([...withoutTask, task]) }
      })
    },
  })
}

/** The order the server returns: timed tasks by time, then the rest in the order they were added. */
function sortTasks(tasks: TaskDto[]) {
  return [...tasks].sort((left, right) => {
    if (left.startMinute === right.startMinute) return left.position - right.position
    if (left.startMinute === null) return 1
    if (right.startMinute === null) return -1
    return left.startMinute - right.startMinute
  })
}

export function useCreateTaskMutation() {
  return useTaskMutation<CreateTaskRequest>((transport, input) => createTask(transport, input))
}

export function useUpdateTaskMutation() {
  return useTaskMutation<{ taskId: string; input: UpdateTaskRequest }>(
    (transport, { taskId, input }) => updateTask(transport, taskId, input),
  )
}

export function useResolveTaskMutation() {
  return useTaskMutation<{ taskId: string; input: ResolveTaskRequest }>(
    (transport, { taskId, input }) => resolveTask(transport, taskId, input),
  )
}

export function useCreateSubtaskMutation() {
  return useTaskMutation<{ taskId: string; title: string }>((transport, { taskId, title }) =>
    createSubtask(transport, taskId, title),
  )
}

export function useUpdateSubtaskMutation() {
  return useTaskMutation<{ subtaskId: string; input: UpdateSubtaskRequest }>(
    (transport, { subtaskId, input }) => updateSubtask(transport, subtaskId, input),
  )
}

export function useDeleteSubtaskMutation() {
  return useTaskMutation<string>((transport, subtaskId) => deleteSubtask(transport, subtaskId))
}

export function useDeleteTaskMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: string) => deleteTask(auth.transport, taskId),
    onSuccess: (day) => {
      queryClient.setQueryData<DayResponse>(dayQueryKeys.day(day.date), day)
    },
  })
}

function useContextMutation<TVariables, TResponse extends Partial<DayContextResponse>>(
  mutationFn: (
    transport: AuthenticatedTransport,
    variables: TVariables,
  ) => Promise<TResponse>,
) {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: TVariables) => mutationFn(auth.transport, variables),
    onSuccess: (response) => {
      queryClient.setQueryData<DayContextResponse>(dayQueryKeys.context(), (current) =>
        current ? { ...current, ...response } : current,
      )
    },
  })
}

export function useUpdateSettingsMutation() {
  return useContextMutation<UpdateSettingsRequest, { settings: DayContextResponse['settings'] }>(
    (transport, input) => updateSettings(transport, input),
  )
}

export function useCreateCategoryMutation() {
  return useContextMutation<
    { title: string; color: string },
    { categories: DayContextResponse['categories'] }
  >((transport, input) => createCategory(transport, input))
}

export function useDeleteCategoryMutation() {
  return useContextMutation<string, { categories: DayContextResponse['categories'] }>(
    (transport, categoryId) => deleteCategory(transport, categoryId),
  )
}

export function useCreateTemplateMutation() {
  return useContextMutation<string, { templates: DayContextResponse['templates'] }>(
    (transport, title) => createTemplate(transport, title),
  )
}

export function useDeleteTemplateMutation() {
  return useContextMutation<string, { templates: DayContextResponse['templates'] }>(
    (transport, templateId) => deleteTemplate(transport, templateId),
  )
}

export function useCreateTemplateItemMutation() {
  return useContextMutation<
    { templateId: string; title: string; startMinute?: number | null; durationMinutes?: number },
    { templates: DayContextResponse['templates'] }
  >((transport, { templateId, ...input }) =>
    createTemplateItem(transport, templateId, { ...input, priority: 'normal' }),
  )
}

/** Applying a template answers with the whole day, since it adds several tasks at once. */
export function useApplyTemplateMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { templateId: string; scheduledOn: string }) =>
      applyTemplate(auth.transport, input),
    onSuccess: (day) => {
      queryClient.setQueryData<DayResponse>(dayQueryKeys.day(day.date), day)
    },
  })
}
