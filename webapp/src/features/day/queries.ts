import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateTaskRequest,
  DayContextResponse,
  RepeatScope,
  RepeatTaskRequest,
  UpdateCategoryRequest,
  UpdateTemplateItemRequest,
  UpdateTemplateRequest,
  DayResponse,
  ResolveTaskRequest,
  TaskDto,
  UpdateSubtaskRequest,
  UpdateTaskRequest,
} from '@dilife/contracts'

import { compareTasksInDay } from '@dilife/contracts'
import { sessionQueryKeys, useAuth } from '@/features/auth'
import { settingsQueryKeys } from '@/features/settings'
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
  deleteTaskInScope,
  deleteTemplate,
  deleteTemplateItem,
  fetchAppliedTemplates,
  fetchDay,
  fetchDayContext,
  fetchStepPlans,
  repeatTask,
  resolveTask,
  saveDayAsTemplate,
  stopRepeat,
  updateCategory,
  updateSubtask,
  updateTask,
  updateTemplate,
  updateTemplateItem,
} from './api'

// Session-scoped, so signing out drops one account's plan instead of showing it to the next.
export const dayQueryKeys = {
  all: [...sessionQueryKeys.all, 'day'] as const,
  day: (date: string) => [...sessionQueryKeys.all, 'day', 'date', date] as const,
  context: () => [...sessionQueryKeys.all, 'day', 'context'] as const,
  stepPlans: () => [...sessionQueryKeys.all, 'day', 'step-plans'] as const,
  applied: (date: string) => [...sessionQueryKeys.all, 'day', 'applied', date] as const,
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
      // What a task write can change elsewhere: the steps panel and the statistics.
      void queryClient.invalidateQueries({ queryKey: dayQueryKeys.stepPlans() })
      void queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.all,
        predicate: (query) => query.queryKey[1] === 'statistics',
      })
      queryClient.setQueriesData<DayResponse>({ queryKey: dayQueryKeys.all }, (current) => {
        if (!current || !('tasks' in current)) return current
        const withoutTask = current.tasks.filter((existing) => existing.id !== task.id)
        if (current.date !== task.scheduledOn) {
          // It left this day: drop it here, and let the day it moved to refetch when opened.
          return withoutTask.length === current.tasks.length
            ? current
            : { ...current, tasks: withoutTask }
        }
        const dayStart =
          queryClient.getQueryData<{ settings: { dayStartMinute: number } }>(
            settingsQueryKeys.current(),
          )?.settings.dayStartMinute ?? 0
        return { ...current, tasks: sortTasks([...withoutTask, task], dayStart) }
      })
    },
  })
}

/**
 * The order the server returns: timed tasks by their place in the person's day, then the rest in
 * the order they were added. The day start is read from the cached settings.
 */
function sortTasks(tasks: TaskDto[], dayStartMinute: number) {
  return [...tasks].sort(compareTasksInDay(dayStartMinute))
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
      void queryClient.invalidateQueries({ queryKey: dayQueryKeys.stepPlans() })
    },
  })
}

/** Deleting an occurrence of a repeat: only it, or it and the following ones (task 18). */
export function useDeleteRepeatingTaskMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, scope }: { taskId: string; scope: RepeatScope }) =>
      deleteTaskInScope(auth.transport, taskId, scope),
    onSuccess: (day) => {
      queryClient.setQueryData<DayResponse>(dayQueryKeys.day(day.date), day)
      // "This and the following" reaches other days.
      void queryClient.invalidateQueries({ queryKey: dayQueryKeys.all })
    },
  })
}

/** Making a task repeat, or changing its repeat, adds and removes tasks on other days. */
export function useRepeatTaskMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: RepeatTaskRequest }) =>
      repeatTask(auth.transport, taskId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dayQueryKeys.all })
    },
  })
}

export function useStopRepeatMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (seriesId: string) => stopRepeat(auth.transport, seriesId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dayQueryKeys.all })
    },
  })
}

/** Goal steps already planned from today on (task 16). */
export function useStepPlansQuery() {
  const auth = useAuth()
  return useQuery({
    queryKey: dayQueryKeys.stepPlans(),
    queryFn: ({ signal }) => fetchStepPlans(auth.transport, { signal }),
  })
}

/** Templates already applied to a day, so applying one again asks first (task 17). */
export function useAppliedTemplatesQuery(date: string) {
  const auth = useAuth()
  return useQuery({
    queryKey: dayQueryKeys.applied(date),
    queryFn: ({ signal }) => fetchAppliedTemplates(auth.transport, date, { signal }),
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

export function useCreateCategoryMutation() {
  return useContextMutation<
    { title: string; color: string },
    { categories: DayContextResponse['categories'] }
  >((transport, input) => createCategory(transport, input))
}

export function useUpdateCategoryMutation() {
  return useContextMutation<
    { categoryId: string; input: UpdateCategoryRequest },
    { categories: DayContextResponse['categories'] }
  >((transport, { categoryId, input }) => updateCategory(transport, categoryId, input))
}

export function useUpdateTemplateMutation() {
  return useContextMutation<
    { templateId: string; input: UpdateTemplateRequest },
    { templates: DayContextResponse['templates'] }
  >((transport, { templateId, input }) => updateTemplate(transport, templateId, input))
}

export function useUpdateTemplateItemMutation() {
  return useContextMutation<
    { itemId: string; input: UpdateTemplateItemRequest },
    { templates: DayContextResponse['templates'] }
  >((transport, { itemId, input }) => updateTemplateItem(transport, itemId, input))
}

export function useDeleteTemplateItemMutation() {
  return useContextMutation<string, { templates: DayContextResponse['templates'] }>(
    (transport, itemId) => deleteTemplateItem(transport, itemId),
  )
}

export function useSaveDayAsTemplateMutation() {
  return useContextMutation<
    { title: string; date: string },
    { templates: DayContextResponse['templates'] }
  >((transport, input) => saveDayAsTemplate(transport, input))
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
      void queryClient.invalidateQueries({ queryKey: dayQueryKeys.applied(day.date) })
    },
  })
}

/**
 * Moving or stretching a block on the timeline (task 15): the block stands in its new place at
 * once, and goes back where it was, with a message, if the save fails.
 */
export function useScheduleTaskMutation(date: string) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const key = dayQueryKeys.day(date)

  return useMutation({
    mutationFn: ({
      taskId,
      input,
    }: {
      taskId: string
      input: { startMinute?: number | null; durationMinutes?: number }
    }) => updateTask(auth.transport, taskId, input),
    onMutate: async ({ taskId, input }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const before = queryClient.getQueryData<DayResponse>(key)
      if (before) {
        queryClient.setQueryData<DayResponse>(key, {
          ...before,
          tasks: before.tasks.map((task) => (task.id === taskId ? { ...task, ...input } : task)),
        })
      }
      return { before }
    },
    onError: (_error, _variables, context) => {
      if (context?.before) queryClient.setQueryData(key, context.before)
    },
    onSuccess: ({ task }) => {
      queryClient.setQueryData<DayResponse>(key, (current) =>
        current
          ? { ...current, tasks: current.tasks.map((each) => (each.id === task.id ? task : each)) }
          : current,
      )
    },
  })
}
