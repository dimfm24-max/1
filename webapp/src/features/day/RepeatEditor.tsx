import type { ScheduleRuleDto, TaskDto } from '@dilife/contracts'
import { useState } from 'react'

import { DateField } from '@/components/DateField'
import { Typography } from '@/components/typography'
import { WeekdayPicker } from '@/components/WeekdayPicker'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect } from '@/components/ui/native-select'
import { describeApiError } from '@/platform/api'
import { formatDate } from '@/platform/intl'
import { describeRepeat } from './day-view'
import { useRepeatTaskMutation, useStopRepeatMutation } from './queries'

type Kind = 'none' | 'weekdays' | 'dates'

/**
 * «Повтор» in the task card (task 18): on weekdays or on chosen dates, until a day or without
 * end. A goal step never repeats (owner's decision), so its card says so instead.
 */
export function RepeatEditor({ task, today }: { task: TaskDto; today: string }) {
  const repeat = task.repeat ?? null
  const [kind, setKind] = useState<Kind>(
    repeat ? (repeat.rule.kind === 'dates' ? 'dates' : 'weekdays') : 'none',
  )
  const [weekdays, setWeekdays] = useState<number[]>(
    repeat?.rule.kind === 'weekdays'
      ? [...repeat.rule.weekdays]
      : [new Date(`${task.scheduledOn}T00:00:00.000Z`).getUTCDay()],
  )
  const [dates, setDates] = useState<string[]>(repeat?.rule.kind === 'dates' ? [...repeat.rule.dates] : [])
  const [endsOn, setEndsOn] = useState(repeat?.endsOn ?? '')
  const save = useRepeatTaskMutation()
  const stop = useStopRepeatMutation()

  if (task.stepId !== null) {
    return (
      <Typography tone="muted" variant="bodySm">
        Шаг цели не повторяется: ставь его в план на нужные дни.
      </Typography>
    )
  }

  const rule: ScheduleRuleDto | null =
    kind === 'weekdays' && weekdays.length > 0
      ? { kind: 'weekdays', weekdays }
      : kind === 'dates' && dates.length > 0
        ? { kind: 'dates', dates }
        : null

  return (
    <div className="flex flex-col gap-3" data-testid="task-repeat">
      {repeat ? (
        <Typography data-testid="task-repeat-summary" variant="bodySm">
          Повторяется {describeRepeat(repeat.rule)}
          {repeat.endsOn ? ` до ${formatDate(repeat.endsOn)}` : ''}.
        </Typography>
      ) : null}
      <Field>
        <FieldLabel htmlFor={`repeat-kind-${task.id}`}>Повтор</FieldLabel>
        <NativeSelect
          data-testid="task-repeat-kind"
          id={`repeat-kind-${task.id}`}
          onChange={(event) => setKind(event.target.value as Kind)}
          value={kind}
        >
          <option value="none">Не повторять</option>
          <option value="weekdays">По дням недели</option>
          <option value="dates">По выбранным датам</option>
        </NativeSelect>
      </Field>
      {kind === 'weekdays' ? (
        <WeekdayPicker label="Дни недели" onChange={setWeekdays} value={weekdays} />
      ) : null}
      {kind === 'dates' ? (
        <div className="flex flex-col gap-2">
          {dates.map((date) => (
            <div className="flex items-center gap-2" key={date}>
              <Typography variant="bodySm">{formatDate(date)}</Typography>
              <Button
                onClick={() => setDates(dates.filter((other) => other !== date))}
                size="sm"
                type="button"
                variant="ghost"
              >
                Убрать
              </Button>
            </div>
          ))}
          <DateField
            aria-label="Добавить дату"
            min={today}
            onChange={(date) =>
              date && !dates.includes(date) ? setDates([...dates, date].sort()) : undefined
            }
            placeholder="Добавить дату"
            value=""
          />
        </div>
      ) : null}
      {kind !== 'none' ? (
        <Field>
          <FieldLabel>До какого дня</FieldLabel>
          <div className="flex items-center gap-2">
            <DateField min={today} onChange={setEndsOn} placeholder="Без конца" value={endsOn} />
            {endsOn ? (
              <Button onClick={() => setEndsOn('')} size="sm" type="button" variant="ghost">
                Без конца
              </Button>
            ) : null}
          </div>
        </Field>
      ) : null}
      {save.isError || stop.isError ? (
        <Typography tone="destructive" variant="bodySm">
          {describeApiError(save.error ?? stop.error, 'Повтор не сохранился. Попробуй ещё раз.')}
        </Typography>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {kind === 'none' ? (
          repeat ? (
            <Button
              data-testid="task-repeat-stop"
              disabled={stop.isPending}
              onClick={() => stop.mutate(repeat.seriesId)}
              size="sm"
              type="button"
              variant="outline"
            >
              Больше не повторять
            </Button>
          ) : null
        ) : (
          <Button
            data-testid="task-repeat-save"
            disabled={rule === null || save.isPending}
            onClick={() =>
              rule && save.mutate({ taskId: task.id, input: { rule, endsOn: endsOn || null } })
            }
            size="sm"
            type="button"
            variant="outline"
          >
            {repeat ? 'Сохранить повтор' : 'Повторять'}
          </Button>
        )}
      </div>
    </div>
  )
}
