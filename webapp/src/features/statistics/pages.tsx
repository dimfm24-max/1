import type { StatisticsPeriod, StatisticsResponse } from '@dilife/contracts'
import { useState } from 'react'

import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { formatDuration } from '@/features/day'
import { useToday } from '@/features/settings'
import { formatDate } from '@/platform/intl'
import { useStatisticsQuery } from './queries'

const periodLabels: Record<StatisticsPeriod, string> = {
  week: 'Неделя',
  month: 'Месяц',
  year: 'Год',
}

export function StatisticsPage() {
  const { today } = useToday()
  const [period, setPeriod] = useState<StatisticsPeriod>('week')
  const statistics = useStatisticsQuery(period, today)

  return (
    <section className="flex flex-col gap-6 p-4 md:p-6" data-testid="statistics-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography as="h1" variant="h5">
          Статистика
        </Typography>
        <div className="flex gap-2">
          {(['week', 'month', 'year'] as const).map((candidate) => (
            <Button
              data-testid={`period-${candidate}`}
              key={candidate}
              onClick={() => setPeriod(candidate)}
              size="sm"
              type="button"
              variant={candidate === period ? 'default' : 'outline'}
            >
              {periodLabels[candidate]}
            </Button>
          ))}
        </div>
      </div>

      {statistics.isPending ? (
        <div className="flex min-h-48 items-center justify-center" data-testid="statistics-loading">
          <Spinner />
        </div>
      ) : statistics.isError ? (
        <Alert data-testid="statistics-error" variant="destructive">
          <AlertTitle>Не удалось загрузить статистику</AlertTitle>
          <AlertDescription>Проверь интернет и обнови страницу.</AlertDescription>
        </Alert>
      ) : (
        <StatisticsBody statistics={statistics.data} />
      )}
    </section>
  )
}

function StatisticsBody({ statistics }: { statistics: StatisticsResponse }) {
  const { totals, daily, goals, habits } = statistics
  const handled = totals.done + totals.burned
  const donePercent = handled === 0 ? 0 : Math.round((totals.done / handled) * 100)
  const peak = Math.max(...daily.map((point) => point.done + point.burned + point.planned), 1)

  return (
    <>
      <Card data-testid="statistics-totals">
        <CardHeader className="gap-2">
          <Typography as="h2" variant="h6">
            {formatDate(statistics.from)} — {formatDate(statistics.to)}
          </Typography>
          <CardDescription>
            Сделано {totals.done} · сгорело {totals.burned} · осталось {totals.planned} ·{' '}
            {formatDuration(totals.doneMinutes)} работы · дней с делами: {totals.activeDays}
          </CardDescription>
          <Progress aria-label="Доля доведённого до конца" value={donePercent} />
        </CardHeader>
      </Card>

      <Card data-testid="statistics-daily">
        <CardHeader>
          <Typography as="h2" variant="h6">
            По дням
          </Typography>
          <CardDescription>
            Высота столбца — сколько задач было на день, тёмная часть — сделанные.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex h-32 items-end gap-1">
            {daily.map((point) => {
              const total = point.done + point.burned + point.planned
              return (
                <li
                  className="flex flex-1 flex-col justify-end gap-[2px]"
                  data-testid={`daily-${point.date}`}
                  key={point.date}
                  title={`${point.date}: сделано ${point.done} из ${total}`}
                >
                  <span
                    className="w-full rounded-t bg-primary"
                    style={{ height: `${(point.done / peak) * 100}%` }}
                  />
                  <span
                    className="w-full bg-muted"
                    style={{ height: `${((total - point.done) / peak) * 100}%` }}
                  />
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Card data-testid="statistics-goals">
        <CardHeader>
          <Typography as="h2" variant="h6">
            Время по целям
          </Typography>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {goals.length === 0 ? (
            <Typography tone="muted" variant="bodySm">
              За этот период ни одна задача не была привязана к шагу цели.
            </Typography>
          ) : (
            goals.map((goal) => (
              <div className="flex items-center justify-between gap-4" key={goal.goalId}>
                <Typography variant="bodySm">{goal.title}</Typography>
                <Typography tone="muted" variant="caption">
                  {formatDuration(goal.minutes)} · шагов: {goal.completedSteps}
                </Typography>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card data-testid="statistics-habits">
        <CardHeader>
          <Typography as="h2" variant="h6">
            Привычки
          </Typography>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {habits.length === 0 ? (
            <Typography tone="muted" variant="bodySm">
              Активных привычек нет.
            </Typography>
          ) : (
            habits.map((habit) => (
              <div className="flex items-center justify-between gap-4" key={habit.habitId}>
                <Typography variant="bodySm">{habit.title}</Typography>
                <Typography tone="muted" variant="caption">
                  серия {habit.currentStreak} · в периоде {habit.markedDays}
                </Typography>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  )
}
