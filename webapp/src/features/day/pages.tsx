import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { DayTemplateDto, TaskCategoryDto, TaskDto } from '@dilife/contracts'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { DashboardTile, PageHeader } from '@/components/dashboard'
import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import type { StepContext } from '@/features/goals'
import { useSettingsQuery, useToday } from '@/features/settings'
import { useToneText } from '@/features/tone'
import { describeApiError } from '@/platform/api'
import { countDay, formatDayHeading, relativeDayLabel, shiftDay, taskWord } from './day-view'
import { DayTimeline, UnscheduledLane } from './DayTimeline'
import {
  useAppliedTemplatesQuery,
  useApplyTemplateMutation,
  useCreateTaskMutation,
  useDayContextQuery,
  useDayQuery,
  useSaveDayAsTemplateMutation,
  useScheduleTaskMutation,
} from './queries'
import { StepsPanel } from './StepsPanel'
import { TaskCard } from './TaskCard'
import {
  fullScale,
  movedStart,
  snapMinutes,
  startAtOffset,
  timelineDropId,
  unscheduledDropId,
} from './timeline'
import { useCompleteTask } from './use-complete-task'

type DragData = { kind: 'task'; task: TaskDto } | { kind: 'step'; context: StepContext }

/**
 * «План дня» (tasks 13, 15, 16, 45). The day comes from the address (`/app/day?date=…`); with
 * none, the page follows today and turns over by itself when the person's day starts.
 */
export function DayPage({
  date: chosenDate,
  highlightTaskId,
  onDateChange,
}: {
  date?: string
  highlightTaskId?: string
  /** Null returns to following today. */
  onDateChange: (date: string | null) => void
}) {
  const { minuteOfDay, today } = useToday()
  const date = chosenDate ?? today
  const setDate = (next: string) => onDateChange(next === today ? null : next)
  const day = useDayQuery(date)
  const context = useDayContextQuery()
  const settings = useSettingsQuery()
  const relative = relativeDayLabel(date, today)

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-8" data-testid="day-page">
      <PageHeader
        actions={
          <>
            <ButtonGroup aria-label="Другие дни">
              <Button
                aria-label="Предыдущий день"
                data-testid="day-previous"
                onClick={() => setDate(shiftDay(date, -1))}
                size="icon"
                type="button"
                variant="outline"
              >
                <HugeiconsIcon aria-hidden icon={ArrowLeft01Icon} strokeWidth={2} />
              </Button>
              <Button
                data-testid="day-today"
                disabled={date === today}
                onClick={() => onDateChange(null)}
                type="button"
                variant="outline"
              >
                Сегодня
              </Button>
              <Button
                aria-label="Следующий день"
                data-testid="day-next"
                onClick={() => setDate(shiftDay(date, 1))}
                size="icon"
                type="button"
                variant="outline"
              >
                <HugeiconsIcon aria-hidden icon={ArrowRight01Icon} strokeWidth={2} />
              </Button>
            </ButtonGroup>
            {context.data ? (
              <TemplateMenu date={date} templates={context.data.templates} today={today} />
            ) : null}
          </>
        }
        eyebrow={relative ? `План дня · ${relative}` : 'План дня'}
        testId="day-header"
        title={formatDayHeading(date)}
      />

      {day.isPending || context.isPending ? (
        <div className="flex flex-col gap-4" data-testid="day-loading">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : day.isError || context.isError ? (
        <Alert data-testid="day-error" variant="destructive">
          <AlertTitle>Не удалось загрузить день</AlertTitle>
          <AlertDescription>Проверь интернет и обнови страницу.</AlertDescription>
        </Alert>
      ) : (
        <DayBody
          categories={context.data.categories}
          date={date}
          dayStartMinute={settings.data?.settings.dayStartMinute ?? 0}
          highlightTaskId={highlightTaskId}
          isToday={date === today}
          minuteOfDay={minuteOfDay}
          tasks={day.data.tasks}
          today={today}
        />
      )}
    </section>
  )
}

function DayBody({
  categories,
  date,
  dayStartMinute,
  highlightTaskId,
  isToday,
  minuteOfDay,
  tasks,
  today,
}: {
  categories: ReadonlyArray<TaskCategoryDto>
  date: string
  dayStartMinute: number
  highlightTaskId?: string
  isToday: boolean
  minuteOfDay: number
  tasks: ReadonlyArray<TaskDto>
  today: string
}) {
  const say = useToneText()
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const openTask = tasks.find((task) => task.id === openTaskId) ?? null
  const schedule = useScheduleTaskMutation(date)
  const create = useCreateTaskMutation()
  const completion = useCompleteTask()
  const counts = countDay(tasks)
  const unscheduled = tasks.filter((task) => task.startMinute === null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const move = (task: TaskDto, input: { startMinute?: number | null; durationMinutes?: number }) =>
    schedule.mutate(
      { taskId: task.id, input },
      {
        onError: (error) =>
          toast.error(describeApiError(error, 'Не сохранилось: задача вернулась на место.')),
      },
    )

  const onDragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current as DragData | undefined
    const over = event.over
    if (!data || !over) return
    if (over.id === unscheduledDropId) {
      if (data.kind === 'task' && data.task.startMinute !== null) move(data.task, { startMinute: null })
      return
    }
    if (over.id !== timelineDropId) return
    if (data.kind === 'task' && data.task.startMinute !== null) {
      const delta = snapMinutes(event.delta.y, fullScale)
      if (delta === 0) return
      move(data.task, {
        startMinute: movedStart(data.task.startMinute, data.task.durationMinutes, delta, dayStartMinute),
      })
      return
    }
    const translated = event.active.rect.current.translated
    if (!translated) return
    const start = startAtOffset(translated.top - over.rect.top, dayStartMinute, fullScale)
    if (data.kind === 'task') {
      move(data.task, { startMinute: start })
      return
    }
    create.mutate(
      {
        scheduledOn: date,
        title: data.context.step.title,
        stepId: data.context.step.id,
        startMinute: start,
        priority: 'normal',
      },
      {
        onError: (error) =>
          toast.error(describeApiError(error, 'Шаг не встал в план. Попробуй ещё раз.')),
      },
    )
  }

  return (
    <DndContext onDragEnd={onDragEnd} sensors={sensors}>
      <QuickAdd date={date} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {tasks.length === 0 ? (
            <Typography data-testid="day-empty" tone="muted" variant="bodySm">
              {say('dayEmpty')}
            </Typography>
          ) : null}
          <UnscheduledLane
            categories={categories}
            onOpenTask={(task) => setOpenTaskId(task.id)}
            onToggle={completion.setCompleted}
            tasks={unscheduled}
          />
          <DayTimeline
            categories={categories}
            dayStartMinute={dayStartMinute}
            highlightTaskId={highlightTaskId}
            isToday={isToday}
            minuteOfDay={minuteOfDay}
            onOpenTask={(task) => setOpenTaskId(task.id)}
            onResize={(task, durationMinutes) => move(task, { durationMinutes })}
            onToggle={completion.setCompleted}
            scale={fullScale}
            tasks={tasks}
          />
        </div>
        <aside className="flex flex-col gap-4">
          <DashboardTile label="Итог дня" testId="day-summary">
            <div className="flex items-baseline">
              <Typography variant="metric">{counts.done}</Typography>
              <Typography tone="muted" variant="metricSm">
                /{counts.total}
              </Typography>
            </div>
            <Progress aria-label="Выполнение дня" value={counts.donePercent} />
            <Typography tone="muted" variant="bodySm">
              {counts.unresolved === 0
                ? counts.total === 0
                  ? 'Задач пока нет.'
                  : 'Все задачи дня закрыты.'
                : `Осталось ${counts.unresolved} ${taskWord(counts.unresolved)}`}
              {counts.burned === 0 ? '' : ` · сгорело ${counts.burned}`}
            </Typography>
          </DashboardTile>
          <StepsPanel date={date} />
        </aside>
      </div>
      <TaskCard
        categories={categories}
        onOpenChange={(open) => (open ? undefined : setOpenTaskId(null))}
        task={openTask}
        today={today}
      />
      {completion.dialog}
    </DndContext>
  )
}

/**
 * Quick add (task 13): one field, Enter, and the task is in the plan without a time; the field
 * empties and keeps the focus for the next one. Everything else is set in the card.
 */
function QuickAdd({ date }: { date: string }) {
  const [title, setTitle] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const mutation = useCreateTaskMutation()

  const submit = () => {
    const trimmed = title.trim()
    if (trimmed === '') return
    mutation.mutate(
      { scheduledOn: date, title: trimmed, priority: 'normal' },
      {
        onSuccess: () => {
          setTitle('')
          input.current?.focus()
        },
      },
    )
  }

  return (
    <form
      className="flex gap-2"
      data-testid="new-task-form"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Input
        aria-label="Новая задача"
        data-testid="task-title"
        maxLength={200}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Новая задача — напиши и нажми Enter"
        ref={input}
        value={title}
      />
      <Button data-testid="task-submit" disabled={title.trim() === '' || mutation.isPending} type="submit">
        Добавить
      </Button>
    </form>
  )
}

/**
 * Templates for the day, a secondary action (task 17): apply one, or save this day as a new one.
 * Applying a template again, or to a past day, asks first.
 */
function TemplateMenu({
  date,
  templates,
  today,
}: {
  date: string
  templates: ReadonlyArray<DayTemplateDto>
  today: string
}) {
  const apply = useApplyTemplateMutation()
  const saveDay = useSaveDayAsTemplateMutation()
  const applied = useAppliedTemplatesQuery(date)
  const [confirm, setConfirm] = useState<DayTemplateDto | null>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')

  const run = (template: DayTemplateDto) =>
    apply.mutate(
      { templateId: template.id, scheduledOn: date },
      {
        onSuccess: () => toast(`Шаблон «${template.title}» добавлен к дню`),
        onError: (error) => toast.error(describeApiError(error, 'Шаблон не применился.')),
      },
    )

  const choose = (template: DayTemplateDto) => {
    if (date < today || applied.data?.templateIds.includes(template.id)) setConfirm(template)
    else run(template)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button data-testid="template-menu" type="button" variant="outline">
            Шаблоны
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Добавить к дню</DropdownMenuLabel>
          {templates.length === 0 ? (
            <DropdownMenuItem disabled>Шаблонов пока нет</DropdownMenuItem>
          ) : (
            templates.map((template) => (
              <DropdownMenuItem
                data-testid={`template-apply-${template.id}`}
                key={template.id}
                onSelect={() => choose(template)}
              >
                {template.title}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem data-testid="template-save-day" onSelect={() => setSaving(true)}>
            Сохранить день как шаблон
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog onOpenChange={(open) => (open ? undefined : setConfirm(null))} open={confirm !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Применить «{confirm?.title}»?</DialogTitle>
            <DialogDescription>
              {confirm && applied.data?.templateIds.includes(confirm.id)
                ? 'Этот шаблон уже добавлен к этому дню. Его задачи появятся ещё раз.'
                : 'Это прошедший день. Задачи шаблона встанут в него.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setConfirm(null)} type="button" variant="ghost">
              Отмена
            </Button>
            <Button
              onClick={() => {
                if (confirm) run(confirm)
                setConfirm(null)
              }}
              type="button"
            >
              Применить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setSaving} open={saving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сохранить день как шаблон</DialogTitle>
            <DialogDescription>Задачи дня станут пунктами нового шаблона.</DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Название шаблона"
            data-testid="template-save-name"
            maxLength={200}
            onChange={(event) => setName(event.target.value)}
            placeholder="Например: выходной"
            value={name}
          />
          <DialogFooter>
            <Button
              data-testid="template-save-submit"
              disabled={name.trim() === '' || saveDay.isPending}
              onClick={() =>
                saveDay.mutate(
                  { title: name.trim(), date },
                  {
                    onSuccess: () => {
                      setSaving(false)
                      setName('')
                      toast('Шаблон сохранён. Его правила — в «Настройках → Шаблоны дня».')
                    },
                  },
                )
              }
              type="button"
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
