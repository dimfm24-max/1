import type { GoalDto } from '@dilife/contracts'
import { useId, useState } from 'react'

import { DateField } from '@/components/DateField'
import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToneText } from '@/features/tone'
import { describeApiError } from '@/platform/api'
import { formatDate, formatNumber } from '@/platform/intl'
import { progressReasonLabel } from './goal-view'
import {
  useCloseGoalMutation,
  useGoalProgressHistoryQuery,
  useRecordProgressMutation,
  useReopenGoalMutation,
  useUpdateGoalMutation,
} from './queries'

/**
 * «Завершить» and «Отказаться» both end in the outcome: what came of it and what the person
 * understood. The text is required (owner's decision on task 10); the congratulation comes in the
 * person's tone.
 */
export function CloseGoalDialog({
  goal,
  onClosed,
  onOpenChange,
  open,
  status,
}: {
  goal: GoalDto
  onClosed?: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  status: 'completed' | 'abandoned'
}) {
  const noteId = useId()
  const [note, setNote] = useState('')
  const [done, setDone] = useState(false)
  const close = useCloseGoalMutation()
  const say = useToneText()
  const trimmed = note.trim()

  const submit = () => {
    if (trimmed === '') return
    close.mutate(
      { goalId: goal.id, input: { status, outcomeNote: trimmed } },
      {
        onSuccess: () => {
          setDone(true)
          onClosed?.()
        },
      },
    )
  }

  const finish = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setNote('')
      setDone(false)
      close.reset()
    }
  }

  return (
    <Dialog onOpenChange={finish} open={open}>
      <DialogContent data-testid="goal-close-dialog">
        <DialogHeader>
          <DialogTitle>
            {done
              ? status === 'completed'
                ? 'Цель завершена'
                : 'Цель в архиве'
              : status === 'completed'
                ? `Завершить «${goal.title}»`
                : `Отказаться от «${goal.title}»`}
          </DialogTitle>
          <DialogDescription>
            {done
              ? say(status === 'completed' ? 'goalCompleted' : 'goalAbandoned', { goal: goal.title })
              : 'Итог останется в архиве вместе с целью.'}
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <DialogFooter>
            <Button data-testid="goal-close-done" onClick={() => finish(false)} type="button">
              Готово
            </Button>
          </DialogFooter>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <Field>
              <FieldLabel htmlFor={noteId}>Итог</FieldLabel>
              <Textarea
                data-testid="goal-outcome"
                id={noteId}
                onChange={(event) => setNote(event.target.value)}
                placeholder={
                  status === 'completed'
                    ? 'Что получилось и что ты понял по дороге'
                    : 'Почему решил отказаться и что понял'
                }
                value={note}
              />
              <FieldDescription>Без итога цель не закрывается.</FieldDescription>
            </Field>
            {close.isError ? (
              <Typography tone="destructive" variant="bodySm">
                {describeApiError(close.error, 'Цель не закрылась. Попробуй ещё раз.')}
              </Typography>
            ) : null}
            <DialogFooter>
              <Button
                data-testid="goal-close-submit"
                disabled={trimmed === '' || close.isPending}
                type="submit"
                variant={status === 'completed' ? 'default' : 'outline'}
              >
                {status === 'completed' ? 'Завершить цель' : 'Отказаться от цели'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * A new deadline in the calendar: returning a goal from the archive, or extending an overdue one.
 * The calendar starts at today, so the date cannot land in the past (task 09).
 */
export function DeadlineDialog({
  goal,
  mode,
  onDone,
  onOpenChange,
  open,
  today,
}: {
  goal: GoalDto
  mode: 'reopen' | 'extend'
  onDone?: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  today: string
}) {
  const dateId = useId()
  const [deadline, setDeadline] = useState('')
  const reopen = useReopenGoalMutation()
  const extend = useUpdateGoalMutation()
  const mutation = mode === 'reopen' ? reopen : extend

  const submit = () => {
    if (deadline === '') return
    const finish = {
      onSuccess: () => {
        onOpenChange(false)
        setDeadline('')
        onDone?.()
      },
    }
    if (mode === 'reopen') reopen.mutate({ goalId: goal.id, deadline }, finish)
    else extend.mutate({ goalId: goal.id, input: { deadline } }, finish)
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent data-testid="goal-deadline-dialog">
        <DialogHeader>
          <DialogTitle>{mode === 'reopen' ? 'Вернуть в работу' : 'Продлить срок'}</DialogTitle>
          <DialogDescription>«{goal.title}» — выбери новый срок.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={dateId}>Новый срок</FieldLabel>
          <DateField
            data-testid="goal-new-deadline"
            id={dateId}
            min={today}
            onChange={setDeadline}
            value={deadline}
          />
        </Field>
        {mutation.isError ? (
          <Typography tone="destructive" variant="bodySm">
            {describeApiError(mutation.error, 'Срок не сохранился. Попробуй ещё раз.')}
          </Typography>
        ) : null}
        <DialogFooter>
          <Button
            data-testid="goal-deadline-submit"
            disabled={deadline === '' || mutation.isPending}
            onClick={submit}
            type="button"
          >
            {mode === 'reopen' ? 'Вернуть в работу' : 'Продлить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The goal's number: a new record for a manual goal, and the history of every move either way
 * (task 08). An automatic goal shows only the history: its number belongs to the steps.
 */
export function ProgressDialog({
  goal,
  onOpenChange,
  open,
}: {
  goal: GoalDto
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const valueId = useId()
  const [value, setValue] = useState('')
  const record = useRecordProgressMutation()
  const history = useGoalProgressHistoryQuery(goal.id, open)
  const parsed = Number(value.trim().replace(',', '.'))
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed >= 0
  const canRecord = goal.progressMode === 'manual' && goal.status === 'active'

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90svh] overflow-y-auto" data-testid="goal-progress-dialog">
        <DialogHeader>
          <DialogTitle>Показатель цели</DialogTitle>
          <DialogDescription>
            {goal.progressMode === 'manual'
              ? `Сейчас ${formatNumber(goal.currentValue)} ${goal.measureUnit}.`
              : 'Число считается по выполненным шагам.'}
          </DialogDescription>
        </DialogHeader>
        {canRecord ? (
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault()
              if (!valid) return
              record.mutate(
                { goalId: goal.id, currentValue: parsed },
                { onSuccess: () => setValue('') },
              )
            }}
          >
            <Field className="flex-1">
              <FieldLabel htmlFor={valueId}>Сейчас, {goal.measureUnit}</FieldLabel>
              <Input
                data-testid="goal-progress-value"
                id={valueId}
                inputMode="decimal"
                onChange={(event) => setValue(event.target.value)}
                value={value}
              />
            </Field>
            <Button
              data-testid="goal-progress-submit"
              disabled={!valid || record.isPending}
              type="submit"
            >
              Записать
            </Button>
          </form>
        ) : null}
        {record.isError ? (
          <Typography tone="destructive" variant="bodySm">
            {describeApiError(record.error, 'Число не записалось. Попробуй ещё раз.')}
          </Typography>
        ) : null}
        <div className="flex flex-col gap-2">
          <Typography as="h3" variant="bodySmMedium">
            История
          </Typography>
          {history.isPending ? (
            <Typography tone="muted" variant="bodySm">
              Загружаем…
            </Typography>
          ) : history.isError ? (
            <Typography tone="destructive" variant="bodySm">
              Историю не удалось загрузить.
            </Typography>
          ) : (
            <ul className="flex flex-col gap-1" data-testid="goal-progress-history">
              {[...history.data.entries].reverse().map((entry) => (
                <li className="flex items-baseline justify-between gap-3" key={entry.at}>
                  <Typography tone="muted" variant="caption">
                    {formatDate(entry.at)} · {progressReasonLabel(entry.reason)}
                  </Typography>
                  <Typography className="tabular-nums" variant="bodySm">
                    {formatNumber(entry.value)} · {Math.round(entry.ratio * 100)}%
                  </Typography>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
