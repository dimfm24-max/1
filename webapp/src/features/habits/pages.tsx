import type { HabitDto } from '@dilife/contracts'
import { useState } from 'react'

import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { toDayDate } from '@/features/day'
import { describeSchedule, formatStreak, habitStrip } from './habit-view'
import {
  useCreateHabitMutation,
  useDeleteHabitMutation,
  useHabitsQuery,
  useMarkHabitMutation,
  useUpdateHabitMutation,
} from './queries'

export function HabitsPage() {
  const [today] = useState(() => toDayDate(new Date()))
  const habits = useHabitsQuery(today)

  if (habits.isPending) {
    return (
      <section className="flex min-h-48 items-center justify-center" data-testid="habits-loading">
        <Spinner />
      </section>
    )
  }

  if (habits.isError) {
    return (
      <Alert data-testid="habits-error" variant="destructive">
        <AlertTitle>Не удалось загрузить привычки</AlertTitle>
        <AlertDescription>Проверьте соединение и обновите страницу.</AlertDescription>
      </Alert>
    )
  }

  const active = habits.data.habits.filter((habit) => habit.archivedAt === null)
  const archived = habits.data.habits.filter((habit) => habit.archivedAt !== null)

  return (
    <section className="flex flex-col gap-6 p-4 md:p-6" data-testid="habits-page">
      <NewHabitForm today={today} />

      <div className="flex flex-col gap-4">
        <Typography as="h2" variant="h6">
          Привычки
        </Typography>
        {active.length === 0 ? (
          <Typography data-testid="habits-empty" tone="muted" variant="bodySm">
            Привычек пока нет. Привычка — это действие, которое повторяется: не сделали в свой
            день, и серия обрывается.
          </Typography>
        ) : (
          active.map((habit) => <HabitCard habit={habit} key={habit.id} today={today} />)
        )}
      </div>

      {archived.length === 0 ? null : (
        <div className="flex flex-col gap-4" data-testid="habits-archive">
          <Typography as="h2" variant="h6">
            Архив
          </Typography>
          {archived.map((habit) => (
            <HabitCard habit={habit} key={habit.id} today={today} />
          ))}
        </div>
      )}
    </section>
  )
}

function HabitCard({ habit, today }: { habit: HabitDto; today: string }) {
  const strip = habitStrip(habit, today)
  const mark = useMarkHabitMutation(today)
  const update = useUpdateHabitMutation(today)
  const remove = useDeleteHabitMutation(today)
  const isArchived = habit.archivedAt !== null

  return (
    <Card data-testid={`habit-${habit.id}`}>
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Typography as="h3" variant="h6">
            {habit.title}
          </Typography>
          <Badge data-testid={`habit-streak-${habit.id}`} variant="secondary">
            {formatStreak(habit.currentStreak)}
          </Badge>
          {isArchived ? <Badge variant="outline">В архиве</Badge> : null}
        </div>
        <CardDescription>
          {describeSchedule(habit)} · рекорд {habit.longestStreak}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-wrap gap-1" data-testid={`habit-strip-${habit.id}`}>
          {strip.map((day) => (
            <li key={day.date}>
              <button
                aria-label={`${habit.title}, ${day.date}`}
                aria-pressed={day.isDone}
                className={stripSquareClass(day.isDue, day.isDone, day.isToday)}
                data-testid={`habit-day-${habit.id}-${day.date}`}
                // A day the habit was never due is not a hole to fill, so it is not clickable.
                disabled={!day.isDue || isArchived || mark.isPending}
                onClick={() =>
                  mark.mutate({ habitId: habit.id, markedOn: day.date, isDone: !day.isDone })
                }
                type="button"
              >
                <Typography variant="caption">{day.weekdayLabel}</Typography>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          <Button
            data-testid={`habit-archive-${habit.id}`}
            onClick={() =>
              update.mutate({ habitId: habit.id, input: { isArchived: !isArchived } })
            }
            size="sm"
            type="button"
            variant="outline"
          >
            {isArchived ? 'Вернуть' : 'В архив'}
          </Button>
          <Button
            data-testid={`habit-delete-${habit.id}`}
            onClick={() => remove.mutate(habit.id)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Удалить
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function stripSquareClass(isDue: boolean, isDone: boolean, isToday: boolean) {
  const base =
    'flex h-9 w-9 items-center justify-center rounded-md border text-xs transition-colors'
  if (!isDue) return `${base} border-dashed text-muted-foreground opacity-50`
  if (isDone) return `${base} bg-primary text-primary-foreground`
  return isToday ? `${base} border-primary` : base
}

function NewHabitForm({ today }: { today: string }) {
  const [title, setTitle] = useState('')
  const [schedule, setSchedule] = useState<'daily' | 'interval'>('daily')
  const [intervalDays, setIntervalDays] = useState('2')
  const mutation = useCreateHabitMutation(today)

  const submit = () => {
    const trimmed = title.trim()
    if (trimmed === '') return
    mutation.mutate(
      {
        title: trimmed,
        schedule,
        intervalDays: schedule === 'interval' ? Number(intervalDays) : undefined,
        // Starting today rather than asking: a habit begun in the past would arrive with a
        // broken streak, which is a discouraging way to meet a new habit.
        startedOn: today,
      },
      { onSuccess: () => setTitle('') },
    )
  }

  return (
    <Card data-testid="new-habit-form">
      <CardHeader>
        <Typography as="h2" variant="h6">
          Новая привычка
        </Typography>
        <CardDescription>
          Серия считается только по дням, когда привычка ожидалась.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          aria-label="Название привычки"
          className="flex-1"
          data-testid="habit-title"
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Например: зарядка"
          value={title}
        />
        <NativeSelect
          aria-label="Как часто"
          data-testid="habit-schedule"
          onChange={(event) => setSchedule(event.target.value === 'interval' ? 'interval' : 'daily')}
          value={schedule}
        >
          <option value="daily">Каждый день</option>
          <option value="interval">Через несколько дней</option>
        </NativeSelect>
        {schedule === 'interval' ? (
          <Input
            aria-label="Раз в сколько дней"
            data-testid="habit-interval"
            max={365}
            min={1}
            onChange={(event) => setIntervalDays(event.target.value)}
            type="number"
            value={intervalDays}
          />
        ) : null}
        <Button
          data-testid="habit-submit"
          disabled={title.trim() === '' || mutation.isPending}
          onClick={submit}
          type="button"
        >
          Создать
        </Button>
      </CardContent>
    </Card>
  )
}
