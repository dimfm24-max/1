import type { TaskDto } from '@dilife/contracts'
import { Link, useNavigate } from '@tanstack/react-router'

import { DashboardTile } from '@/components/dashboard'
import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { useSettingsQuery } from '@/features/settings'
import { useToneText } from '@/features/tone'
import { countDay, formatDuration, taskWord } from './day-view'
import { DayTimeline, UnscheduledLane } from './DayTimeline'
import { useDayContextQuery, useDayQuery } from './queries'
import { compactScale } from './timeline'
import { useCompleteTask } from './use-complete-task'

/** Done out of planned for today, the one number a person checks the day against. */
export function DaySummaryTile({ today }: { today: string }) {
  const day = useDayQuery(today)
  const label = 'Итог дня'

  if (day.isPending) {
    return (
      <DashboardTile label={label} testId="today-summary-loading">
        <Skeleton className="h-24 w-full" />
      </DashboardTile>
    )
  }

  if (day.isError) {
    return (
      <DashboardTile label={label} testId="today-summary-error">
        <Typography tone="muted" variant="bodySm">
          Итог сейчас недоступен.
        </Typography>
      </DashboardTile>
    )
  }

  const counts = countDay(day.data.tasks)
  if (counts.total === 0) {
    return (
      <DashboardTile label={label} testId="today-summary-empty">
        <Typography tone="muted" variant="bodySm">
          На сегодня ничего не запланировано.
        </Typography>
        <Button asChild className="mt-auto self-start" variant="secondary">
          <Link to="/app/day">Спланировать день</Link>
        </Button>
      </DashboardTile>
    )
  }

  return (
    <DashboardTile label={label} testId="today-summary">
      <div className="flex items-baseline">
        <Typography data-testid="today-summary-done" variant="metric">
          {counts.done}
        </Typography>
        <Typography tone="muted" variant="metricSm">
          /{counts.total}
        </Typography>
      </div>
      <div className="mt-auto flex flex-col gap-2">
        <Progress aria-label="Выполнение дня" className="h-2" value={counts.donePercent} />
        <Typography tone="muted" variant="bodySm">
          {counts.unresolved === 0
            ? 'Все задачи дня закрыты.'
            : `Впереди ${counts.unresolved} ${taskWord(counts.unresolved)}`}
          {counts.burned === 0 ? null : ` · сгорело ${counts.burned}`}
        </Typography>
      </div>
    </DashboardTile>
  )
}

/**
 * Today's plan as the compact timeline (task 45): the same blocks as «План дня» with a "now"
 * line, ticked off right here. Moving, editing and adding stay on the day plan.
 */
export function TodayTimeline({ minuteOfDay, today }: { minuteOfDay: number; today: string }) {
  const say = useToneText()
  const day = useDayQuery(today)
  const context = useDayContextQuery()
  const settings = useSettingsQuery()
  const navigate = useNavigate()
  const completion = useCompleteTask()
  const label = 'План дня'
  const openDay = (
    <Button asChild size="sm" variant="ghost">
      <Link data-testid="today-open-day" to="/app/day">
        Открыть план
      </Link>
    </Button>
  )

  if (day.isPending || context.isPending) {
    return (
      <DashboardTile label={label} testId="today-plan-loading">
        <Skeleton className="h-64 w-full" />
      </DashboardTile>
    )
  }

  if (day.isError || context.isError) {
    return (
      <DashboardTile action={openDay} label={label} testId="today-plan-error">
        <Typography tone="muted" variant="bodySm">
          Не удалось загрузить план. Проверь соединение и обнови страницу.
        </Typography>
      </DashboardTile>
    )
  }

  const tasks = day.data.tasks
  if (tasks.length === 0) {
    return (
      <DashboardTile label={label} testId="today-plan-empty">
        <Typography tone="muted" variant="bodySm">
          {say('dayEmpty')}
        </Typography>
        <Button asChild className="self-start" data-testid="today-plan-create">
          <Link to="/app/day">Спланировать день</Link>
        </Button>
      </DashboardTile>
    )
  }

  const totalMinutes = tasks.reduce((sum, task) => sum + task.durationMinutes, 0)
  const open = (task: TaskDto) =>
    void navigate({ to: '/app/day', search: { date: undefined, task: task.id } })
  const unscheduled = tasks.filter((task) => task.startMinute === null)

  return (
    <DashboardTile action={openDay} label={label} testId="today-plan">
      <Typography tone="muted" variant="bodySm">
        {tasks.length} {taskWord(tasks.length)} · {formatDuration(totalMinutes)}
      </Typography>
      {unscheduled.length > 0 ? (
        <UnscheduledLane
          categories={context.data.categories}
          compact
          onOpenTask={open}
          onToggle={completion.setCompleted}
          tasks={unscheduled}
        />
      ) : null}
      <DayTimeline
        categories={context.data.categories}
        compact
        dayStartMinute={settings.data?.settings.dayStartMinute ?? 0}
        isToday
        minuteOfDay={minuteOfDay}
        onOpenTask={open}
        onToggle={completion.setCompleted}
        scale={compactScale}
        tasks={tasks}
      />
      {completion.dialog}
    </DashboardTile>
  )
}
