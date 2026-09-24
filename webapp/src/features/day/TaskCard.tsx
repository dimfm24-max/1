import type { RepeatScope, TaskCategoryDto, TaskDto, TaskPriority, UpdateTaskRequest } from '@dilife/contracts'
import { useId, useState } from 'react'

import { ColorPicker } from '@/components/ColorPicker'
import { DateField } from '@/components/DateField'
import { TimeField } from '@/components/TimeField'
import { Typography } from '@/components/typography'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { findStep, openSteps, useGoalTreeQuery } from '@/features/goals'
import { useTrashedNotice } from '@/features/trash'
import { describeApiError } from '@/platform/api'
import { formatDate, formatDuration } from '@/platform/intl'
import { shiftDay } from './day-view'
import {
  useCreateSubtaskMutation,
  useDeleteRepeatingTaskMutation,
  useDeleteSubtaskMutation,
  useDeleteTaskMutation,
  useResolveTaskMutation,
  useUpdateSubtaskMutation,
  useUpdateTaskMutation,
} from './queries'
import { RepeatEditor } from './RepeatEditor'

const durations = [15, 30, 45, 60, 90, 120, 180, 240] as const

/**
 * The task card (task 13): every property of a task, opened beside the plan by a click on the
 * task. Each field saves when it is left, so there is no «Сохранить» to forget. For an
 * occurrence of a repeat the card asks once whether changes reach only it or the ones after.
 */
export function TaskCard({
  categories,
  onOpenChange,
  task,
  today,
}: {
  categories: ReadonlyArray<TaskCategoryDto>
  onOpenChange: (open: boolean) => void
  task: TaskDto | null
  today: string
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open={task !== null}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md" data-testid="task-card">
        {task ? (
          <TaskCardBody
            categories={categories}
            key={task.id}
            onClose={() => onOpenChange(false)}
            task={task}
            today={today}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function TaskCardBody({
  categories,
  onClose,
  task,
  today,
}: {
  categories: ReadonlyArray<TaskCategoryDto>
  onClose: () => void
  task: TaskDto
  today: string
}) {
  const id = useId()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [scope, setScope] = useState<RepeatScope>('this')
  const update = useUpdateTaskMutation()
  const resolve = useResolveTaskMutation()
  const remove = useDeleteTaskMutation()
  const removeRepeating = useDeleteRepeatingTaskMutation()
  const notifyTrashed = useTrashedNotice()
  const tree = useGoalTreeQuery()
  const goals = tree.data?.goals ?? []
  const stepContext = findStep(goals, task.stepId)
  const steps = openSteps(goals)
  const category = categories.find((candidate) => candidate.id === task.categoryId) ?? null
  const isBurned = task.outcome === 'burned'
  const inSeries = Boolean(task.repeat)

  const save = (input: UpdateTaskRequest) =>
    update.mutate({ taskId: task.id, input: inSeries ? { ...input, scope } : input })

  const deleteTask = (deleteScope: RepeatScope) => {
    const done = {
      onSuccess: () => {
        onClose()
        notifyTrashed('task', task.id, `Задача «${task.title}»`)
      },
    }
    if (inSeries) removeRepeating.mutate({ taskId: task.id, scope: deleteScope }, done)
    else remove.mutate(task.id, done)
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <SheetHeader className="p-0">
        <SheetTitle>Задача</SheetTitle>
        <SheetDescription>
          {formatDate(task.scheduledOn)}
          {task.outcome === 'done' ? ' · выполнена' : isBurned ? ' · сгорела' : ''}
        </SheetDescription>
      </SheetHeader>

      {inSeries ? (
        <Field>
          <FieldLabel htmlFor={`${id}-scope`}>Изменения касаются</FieldLabel>
          <NativeSelect
            data-testid="task-card-scope"
            id={`${id}-scope`}
            onChange={(event) => setScope(event.target.value === 'following' ? 'following' : 'this')}
            value={scope}
          >
            <option value="this">Только этой задачи</option>
            <option value="following">Этой и следующих повторов</option>
          </NativeSelect>
        </Field>
      ) : null}

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-title`}>Название</FieldLabel>
          <Input
            data-testid="task-card-title"
            disabled={isBurned}
            id={`${id}-title`}
            maxLength={200}
            onBlur={() => {
              const trimmed = title.trim()
              if (trimmed !== '' && trimmed !== task.title) save({ title: trimmed })
              else setTitle(task.title)
            }}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-description`}>Описание</FieldLabel>
          <Textarea
            data-testid="task-card-description"
            disabled={isBurned}
            id={`${id}-description`}
            onBlur={() => {
              const next = description.trim() === '' ? null : description.trim()
              if (next !== task.description) save({ description: next })
            }}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Подробности, ссылки, мысли"
            value={description}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={`${id}-date`}>День</FieldLabel>
            <DateField
              data-testid="task-card-date"
              disabled={isBurned}
              id={`${id}-date`}
              onChange={(date) => date && date !== task.scheduledOn && save({ scheduledOn: date })}
              value={task.scheduledOn}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-time`}>Начало</FieldLabel>
            <TimeField
              data-testid="task-card-time"
              disabled={isBurned}
              id={`${id}-time`}
              onChange={(minute) => minute !== task.startMinute && save({ startMinute: minute })}
              placeholder="без времени"
              value={task.startMinute}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor={`${id}-duration`}>Длительность</FieldLabel>
            <NativeSelect
              data-testid="task-card-duration"
              disabled={isBurned}
              id={`${id}-duration`}
              onChange={(event) => save({ durationMinutes: Number(event.target.value) })}
              value={String(task.durationMinutes)}
            >
              {[...new Set([...durations, task.durationMinutes])]
                .sort((a, b) => a - b)
                .map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatDuration(minutes)}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-priority`}>Приоритет</FieldLabel>
            <NativeSelect
              data-testid="task-card-priority"
              disabled={isBurned}
              id={`${id}-priority`}
              onChange={(event) => save({ priority: event.target.value as TaskPriority })}
              value={task.priority}
            >
              <option value="normal">Обычная</option>
              <option value="important">Важная</option>
              <option value="urgent">Срочная</option>
            </NativeSelect>
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor={`${id}-category`}>Категория</FieldLabel>
          <NativeSelect
            data-testid="task-card-category"
            disabled={isBurned}
            id={`${id}-category`}
            onChange={(event) =>
              save({ categoryId: event.target.value === '' ? null : event.target.value })
            }
            value={task.categoryId ?? ''}
          >
            <option value="">Без категории</option>
            {categories.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel>Свой цвет</FieldLabel>
          <ColorPicker
            allowNone
            disabled={isBurned}
            label="Свой цвет задачи"
            noneLabel={category ? 'Как у категории' : 'Без цвета'}
            onChange={(color) => save({ colorOverride: color })}
            value={task.colorOverride}
          />
          <FieldDescription>Свой цвет важнее цвета категории.</FieldDescription>
        </Field>

        {inSeries ? null : (
          <Field>
            <FieldLabel htmlFor={`${id}-step`}>Шаг цели</FieldLabel>
            <NativeSelect
              data-testid="task-card-step"
              disabled={isBurned}
              id={`${id}-step`}
              onChange={(event) =>
                save({ stepId: event.target.value === '' ? null : event.target.value })
              }
              value={task.stepId ?? ''}
            >
              <option value="">Не относится к цели</option>
              {stepContext && stepContext.step.completedAt !== null ? (
                <option value={stepContext.step.id}>{stepContext.step.title} (выполнен)</option>
              ) : null}
              {goals
                .filter((goal) => goal.status === 'active')
                .map((goal) => (
                  <optgroup key={goal.id} label={goal.title}>
                    {steps
                      .filter((context) => context.goal.id === goal.id)
                      .map((context) => (
                        <option key={context.step.id} value={context.step.id}>
                          {context.stage.title}: {context.step.title}
                        </option>
                      ))}
                  </optgroup>
                ))}
            </NativeSelect>
            {stepContext ? (
              <FieldDescription>
                Цель «{stepContext.goal.title}» · этап «{stepContext.stage.title}»
              </FieldDescription>
            ) : null}
          </Field>
        )}
      </FieldGroup>

      {update.isError ? (
        <Typography tone="destructive" variant="bodySm">
          {describeApiError(update.error, 'Не сохранилось. Попробуй ещё раз.')}
        </Typography>
      ) : null}

      <Separator />
      <Subtasks disabled={isBurned} task={task} />

      <Separator />
      <RepeatEditor task={task} today={today} />

      <Separator />
      <div className="flex flex-col gap-2">
        {task.outcome === 'planned' ? (
          <div className="flex flex-wrap gap-2">
            <Button
              data-testid="task-card-tomorrow"
              onClick={() =>
                resolve.mutate({
                  taskId: task.id,
                  // Tomorrow from the person's today, not from the task's own day (task 20).
                  input: { action: 'move', scheduledOn: shiftDay(today, 1) },
                })
              }
              size="sm"
              type="button"
              variant="outline"
            >
              На завтра
            </Button>
            <Button
              data-testid="task-card-burn"
              onClick={() => resolve.mutate({ taskId: task.id, input: { action: 'burn' } })}
              size="sm"
              type="button"
              variant="outline"
            >
              Сжечь
            </Button>
          </div>
        ) : null}
        {isBurned ? (
          <Button
            onClick={() =>
              resolve.mutate({ taskId: task.id, input: { action: 'move', scheduledOn: today } })
            }
            size="sm"
            type="button"
            variant="outline"
          >
            Вернуть в план на сегодня
          </Button>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            data-testid="task-card-delete"
            disabled={remove.isPending || removeRepeating.isPending}
            onClick={() => deleteTask('this')}
            size="sm"
            type="button"
            variant="ghost"
          >
            {inSeries ? 'Удалить только эту' : 'Удалить'}
          </Button>
          {inSeries ? (
            <Button
              data-testid="task-card-delete-following"
              disabled={removeRepeating.isPending}
              onClick={() => deleteTask('following')}
              size="sm"
              type="button"
              variant="ghost"
            >
              Удалить эту и следующие
            </Button>
          ) : null}
        </div>
        {task.movedFrom ? (
          <Badge className="self-start" variant="outline">
            Перенесена с {formatDate(task.movedFrom)}
          </Badge>
        ) : null}
      </div>
    </div>
  )
}

function Subtasks({ disabled, task }: { disabled: boolean; task: TaskDto }) {
  const [title, setTitle] = useState('')
  const create = useCreateSubtaskMutation()
  const update = useUpdateSubtaskMutation()
  const remove = useDeleteSubtaskMutation()

  return (
    <div className="flex flex-col gap-2" data-testid="task-card-subtasks">
      <Typography as="h3" variant="bodySmMedium">
        Подзадачи
      </Typography>
      {task.subtasks.map((subtask) => (
        <SubtaskRow
          disabled={disabled}
          key={subtask.id}
          onDelete={() => remove.mutate(subtask.id)}
          onRename={(next) => update.mutate({ subtaskId: subtask.id, input: { title: next } })}
          onToggle={(done) => update.mutate({ subtaskId: subtask.id, input: { isCompleted: done } })}
          subtask={subtask}
        />
      ))}
      {disabled ? null : (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = title.trim()
            if (trimmed === '') return
            create.mutate({ taskId: task.id, title: trimmed }, { onSuccess: () => setTitle('') })
          }}
        >
          <Input
            aria-label={`Подзадача для «${task.title}»`}
            data-testid={`subtask-input-${task.id}`}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Новая подзадача"
            value={title}
          />
          <Button
            data-testid={`subtask-submit-${task.id}`}
            disabled={title.trim() === '' || create.isPending}
            size="sm"
            type="submit"
            variant="secondary"
          >
            Добавить
          </Button>
        </form>
      )}
    </div>
  )
}

function SubtaskRow({
  disabled,
  onDelete,
  onRename,
  onToggle,
  subtask,
}: {
  disabled: boolean
  onDelete: () => void
  onRename: (title: string) => void
  onToggle: (done: boolean) => void
  subtask: TaskDto['subtasks'][number]
}) {
  const [title, setTitle] = useState(subtask.title)
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        aria-label={subtask.title}
        checked={subtask.completedAt !== null}
        data-testid={`subtask-${subtask.id}`}
        disabled={disabled}
        onCheckedChange={(checked) => onToggle(checked === true)}
      />
      <Input
        aria-label="Название подзадачи"
        disabled={disabled}
        maxLength={200}
        onBlur={() => {
          const trimmed = title.trim()
          if (trimmed !== '' && trimmed !== subtask.title) onRename(trimmed)
          else setTitle(subtask.title)
        }}
        onChange={(event) => setTitle(event.target.value)}
        value={title}
      />
      {disabled ? null : (
        <Button
          aria-label={`Удалить подзадачу «${subtask.title}»`}
          onClick={onDelete}
          size="sm"
          type="button"
          variant="ghost"
        >
          Удалить
        </Button>
      )}
    </div>
  )
}
