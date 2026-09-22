import type { TaskCategoryDto, TaskDto } from '@dilife/contracts'
import { useState } from 'react'

import { Typography } from '@/components/typography'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { formatDuration, formatMinuteOfDay } from './day-view'
import {
  useCreateSubtaskMutation,
  useDeleteTaskMutation,
  useResolveTaskMutation,
  useUpdateSubtaskMutation,
  useUpdateTaskMutation,
} from './queries'

const priorityLabels = {
  normal: null,
  important: 'Важно',
  urgent: 'Срочно',
} as const

/**
 * One task in the plan. Everything it can do is on the row: a person planning a day works
 * through it top to bottom, and burying "move to tomorrow" in a menu is what makes people leave
 * the task sitting there instead.
 */
export function TaskRow({
  categories,
  isOverlapping,
  task,
  tomorrow,
}: {
  categories: ReadonlyArray<TaskCategoryDto>
  isOverlapping: boolean
  task: TaskDto
  tomorrow: string
}) {
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const update = useUpdateTaskMutation()
  const resolve = useResolveTaskMutation()
  const remove = useDeleteTaskMutation()
  const createSubtask = useCreateSubtaskMutation()
  const updateSubtask = useUpdateSubtaskMutation()

  const category = categories.find((candidate) => candidate.id === task.categoryId)
  const color = task.colorOverride ?? category?.color ?? null
  const isClosed = task.outcome !== 'planned'
  const priorityLabel = priorityLabels[task.priority]

  const addSubtask = () => {
    const title = subtaskTitle.trim()
    if (title === '') return
    createSubtask.mutate({ taskId: task.id, title }, { onSuccess: () => setSubtaskTitle('') })
  }

  return (
    <li
      className="flex flex-col gap-2 rounded-lg border p-3"
      data-testid={`task-${task.id}`}
      style={color ? { borderLeftColor: color, borderLeftWidth: 4 } : undefined}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          aria-label={task.title}
          checked={task.outcome === 'done'}
          data-testid={`task-done-${task.id}`}
          disabled={task.outcome === 'burned' || update.isPending}
          onCheckedChange={(checked) =>
            update.mutate({ taskId: task.id, input: { isCompleted: checked === true } })
          }
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Typography
              tone={isClosed ? 'muted' : undefined}
              variant="bodySmMedium"
            >
              {task.title}
            </Typography>
            {priorityLabel ? (
              <Badge variant={task.priority === 'urgent' ? 'destructive' : 'secondary'}>
                {priorityLabel}
              </Badge>
            ) : null}
            {task.outcome === 'burned' ? <Badge variant="outline">Сгорела</Badge> : null}
            {isOverlapping ? (
              <Badge data-testid={`task-overlap-${task.id}`} variant="outline">
                Пересечение
              </Badge>
            ) : null}
            {task.movedFrom ? (
              <Badge variant="outline">Перенесена с {task.movedFrom}</Badge>
            ) : null}
          </div>
          <Typography tone="muted" variant="caption">
            {task.startMinute === null
              ? 'без времени'
              : `${formatMinuteOfDay(task.startMinute)} · ${formatDuration(task.durationMinutes)}`}
            {category ? ` · ${category.title}` : ''}
          </Typography>
        </div>
      </div>

      {task.subtasks.length === 0 ? null : (
        <ul className="ml-8 flex flex-col gap-1">
          {task.subtasks.map((subtask) => (
            <li className="flex items-center gap-2" key={subtask.id}>
              <Checkbox
                aria-label={subtask.title}
                checked={subtask.completedAt !== null}
                data-testid={`subtask-${subtask.id}`}
                disabled={isClosed}
                onCheckedChange={(checked) =>
                  updateSubtask.mutate({
                    subtaskId: subtask.id,
                    input: { isCompleted: checked === true },
                  })
                }
              />
              <Typography
                tone={subtask.completedAt === null ? undefined : 'muted'}
                variant="bodySm"
              >
                {subtask.title}
              </Typography>
            </li>
          ))}
        </ul>
      )}

      {isClosed ? null : (
        <div className="ml-8 flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label={`Подзадача для «${task.title}»`}
            data-testid={`subtask-input-${task.id}`}
            maxLength={200}
            onChange={(event) => setSubtaskTitle(event.target.value)}
            placeholder="Подзадача"
            value={subtaskTitle}
          />
          <Button
            data-testid={`subtask-submit-${task.id}`}
            disabled={subtaskTitle.trim() === '' || createSubtask.isPending}
            onClick={addSubtask}
            size="sm"
            type="button"
            variant="secondary"
          >
            Добавить
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {task.outcome === 'planned' ? (
          <>
            <Button
              data-testid={`task-move-${task.id}`}
              onClick={() =>
                resolve.mutate({
                  taskId: task.id,
                  input: { action: 'move', scheduledOn: tomorrow },
                })
              }
              size="sm"
              type="button"
              variant="outline"
            >
              На завтра
            </Button>
            <Button
              data-testid={`task-burn-${task.id}`}
              onClick={() => resolve.mutate({ taskId: task.id, input: { action: 'burn' } })}
              size="sm"
              type="button"
              variant="outline"
            >
              Отпустить
            </Button>
          </>
        ) : null}
        <Button
          data-testid={`task-delete-${task.id}`}
          onClick={() => remove.mutate(task.id)}
          size="sm"
          type="button"
          variant="ghost"
        >
          Удалить
        </Button>
      </div>
    </li>
  )
}
