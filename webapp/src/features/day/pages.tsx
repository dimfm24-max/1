import type { TaskCategoryDto, TaskDto } from '@dilife/contracts'
import { useState } from 'react'

import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import {
  countDay,
  formatDayHeading,
  overlappingTaskIds,
  relativeDayLabel,
  shiftDay,
  toDayDate,
} from './day-view'
import {
  useApplyTemplateMutation,
  useCreateTaskMutation,
  useDayContextQuery,
  useDayQuery,
} from './queries'
import { TaskRow } from './TaskRow'

export function DayPage() {
  // Today is whatever the viewer's own clock says, so the plan matches the day they are living.
  const [today] = useState(() => toDayDate(new Date()))
  const [date, setDate] = useState(today)
  const day = useDayQuery(date)
  const context = useDayContextQuery()

  const relative = relativeDayLabel(date, today)

  return (
    <section className="flex flex-col gap-6 p-4 md:p-6" data-testid="day-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Typography as="h1" variant="h5">
            {formatDayHeading(date)}
          </Typography>
          {relative ? (
            <Badge data-testid="day-relative" variant="secondary">
              {relative}
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            data-testid="day-previous"
            onClick={() => setDate(shiftDay(date, -1))}
            size="sm"
            type="button"
            variant="outline"
          >
            Назад
          </Button>
          <Button
            data-testid="day-today"
            disabled={date === today}
            onClick={() => setDate(today)}
            size="sm"
            type="button"
            variant="outline"
          >
            Сегодня
          </Button>
          <Button
            data-testid="day-next"
            onClick={() => setDate(shiftDay(date, 1))}
            size="sm"
            type="button"
            variant="outline"
          >
            Вперёд
          </Button>
        </div>
      </div>

      {day.isPending || context.isPending ? (
        <div className="flex min-h-48 items-center justify-center" data-testid="day-loading">
          <Spinner />
        </div>
      ) : day.isError || context.isError ? (
        <Alert data-testid="day-error" variant="destructive">
          <AlertTitle>Не удалось загрузить день</AlertTitle>
          <AlertDescription>Проверьте соединение и обновите страницу.</AlertDescription>
        </Alert>
      ) : (
        <DayBody
          categories={context.data.categories}
          date={date}
          tasks={day.data.tasks}
          templates={context.data.templates}
        />
      )}
    </section>
  )
}

function DayBody({
  categories,
  date,
  tasks,
  templates,
}: {
  categories: ReadonlyArray<TaskCategoryDto>
  date: string
  tasks: ReadonlyArray<TaskDto>
  templates: ReadonlyArray<{ id: string; title: string }>
}) {
  const counts = countDay(tasks)
  const overlapping = overlappingTaskIds(tasks)
  const tomorrow = shiftDay(date, 1)

  return (
    <>
      <Card data-testid="day-summary">
        <CardHeader className="gap-2">
          <Typography as="h2" variant="h6">
            Итог дня
          </Typography>
          <CardDescription>
            Сделано {counts.done} из {counts.total} · отпущено {counts.burned} · осталось{' '}
            {counts.unresolved}
          </CardDescription>
          <Progress aria-label="Выполнение дня" value={counts.donePercent} />
        </CardHeader>
      </Card>

      <NewTaskForm categories={categories} date={date} />

      {templates.length === 0 ? null : (
        <ApplyTemplatePanel date={date} templates={templates} />
      )}

      <div className="flex flex-col gap-3">
        <Typography as="h2" variant="h6">
          План
        </Typography>
        {tasks.length === 0 ? (
          <Typography data-testid="day-empty" tone="muted" variant="bodySm">
            На этот день ничего не запланировано. Добавьте первую задачу — или примените шаблон.
          </Typography>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskRow
                categories={categories}
                isOverlapping={overlapping.has(task.id)}
                key={task.id}
                task={task}
                tomorrow={tomorrow}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function NewTaskForm({
  categories,
  date,
}: {
  categories: ReadonlyArray<TaskCategoryDto>
  date: string
}) {
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal')
  const mutation = useCreateTaskMutation()

  const submit = () => {
    const trimmed = title.trim()
    if (trimmed === '') return
    mutation.mutate(
      {
        scheduledOn: date,
        title: trimmed,
        // An empty time means the task belongs to the day without an hour, which the plan shows
        // separately rather than pinning it to midnight.
        startMinute: time === '' ? null : minutesFromTime(time),
        priority,
        categoryId: categoryId === '' ? null : categoryId,
      },
      {
        onSuccess: () => {
          setTitle('')
          setTime('')
        },
      },
    )
  }

  return (
    <Card data-testid="new-task-form">
      <CardHeader>
        <Typography as="h2" variant="h6">
          Новая задача
        </Typography>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          aria-label="Название задачи"
          className="flex-1"
          data-testid="task-title"
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Что нужно сделать"
          value={title}
        />
        <Input
          aria-label="Время начала"
          data-testid="task-time"
          onChange={(event) => setTime(event.target.value)}
          type="time"
          value={time}
        />
        <NativeSelect
          aria-label="Приоритет"
          data-testid="task-priority"
          onChange={(event) =>
            setPriority(event.target.value as 'normal' | 'important' | 'urgent')
          }
          value={priority}
        >
          <option value="normal">Обычная</option>
          <option value="important">Важная</option>
          <option value="urgent">Срочная</option>
        </NativeSelect>
        {categories.length === 0 ? null : (
          <NativeSelect
            aria-label="Категория"
            data-testid="task-category"
            onChange={(event) => setCategoryId(event.target.value)}
            value={categoryId}
          >
            <option value="">Без категории</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.title}
              </option>
            ))}
          </NativeSelect>
        )}
        <Button
          data-testid="task-submit"
          disabled={title.trim() === '' || mutation.isPending}
          onClick={submit}
          type="button"
        >
          Добавить
        </Button>
      </CardContent>
    </Card>
  )
}

function ApplyTemplatePanel({
  date,
  templates,
}: {
  date: string
  templates: ReadonlyArray<{ id: string; title: string }>
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const mutation = useApplyTemplateMutation()

  return (
    <Card data-testid="apply-template">
      <CardHeader>
        <Typography as="h2" variant="h6">
          Шаблон дня
        </Typography>
        <CardDescription>Добавляет задачи шаблона к этому дню, не заменяя их.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <NativeSelect
          aria-label="Шаблон"
          data-testid="template-select"
          onChange={(event) => setTemplateId(event.target.value)}
          value={templateId}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.title}
            </option>
          ))}
        </NativeSelect>
        <Button
          data-testid="template-apply"
          disabled={templateId === '' || mutation.isPending}
          onClick={() => mutation.mutate({ templateId, scheduledOn: date })}
          type="button"
          variant="secondary"
        >
          Применить
        </Button>
      </CardContent>
    </Card>
  )
}

/** "08:30" from a time input becomes 510 minutes past midnight, which is how a day is stored. */
function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(':')
  return Number(hours) * 60 + Number(minutes)
}
