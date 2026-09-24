import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { DateField } from '@/components/DateField'
import { TimeField } from '@/components/TimeField'
import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { openSteps, useGoalTreeQuery, type StepContext } from '@/features/goals'
import { useToday } from '@/features/settings'
import { describeApiError } from '@/platform/api'
import { formatDate } from '@/platform/intl'
import { shiftDay } from './day-view'
import { useCreateTaskMutation, useStepPlansQuery } from './queries'

/**
 * «Шаги целей» beside the day (task 16): steps still to do in goals in work. A step goes into
 * the day with «В план» or by dragging it onto the timeline; it can stand in several days, each
 * time as its own task. The app never places steps by itself.
 */
export function StepsPanel({ date }: { date: string }) {
  const tree = useGoalTreeQuery()
  const plans = useStepPlansQuery()
  const create = useCreateTaskMutation()
  const steps = openSteps(tree.data?.goals ?? [])
  const plannedOn = new Map<string, string[]>()
  for (const plan of plans.data?.plans ?? []) {
    plannedOn.set(plan.stepId, [...(plannedOn.get(plan.stepId) ?? []), plan.scheduledOn])
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border p-3" data-testid="day-steps">
      <Typography tone="muted" variant="eyebrow">
        Шаги целей
      </Typography>
      {tree.isPending ? (
        <Typography tone="muted" variant="caption">
          Загружаем…
        </Typography>
      ) : steps.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <Typography tone="muted" variant="caption">
            Невыполненных шагов нет. Разбей цель на шаги — и ставь их в день.
          </Typography>
          <Button asChild size="sm" variant="outline">
            <Link search={{ goal: undefined, view: undefined }} to="/app/goals">
              К целям
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {steps.map((context) => (
            <StepItem
              context={context}
              key={context.step.id}
              onPlan={() =>
                create.mutate(
                  {
                    scheduledOn: date,
                    title: context.step.title,
                    stepId: context.step.id,
                    priority: 'normal',
                  },
                  {
                    onSuccess: () => toast(`«${context.step.title}» — в плане на ${formatDate(date)}`),
                    onError: (error) =>
                      toast.error(describeApiError(error, 'Шаг не встал в план. Попробуй ещё раз.')),
                  },
                )
              }
              plannedOn={plannedOn.get(context.step.id) ?? []}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function StepItem({
  context,
  onPlan,
  plannedOn,
}: {
  context: StepContext
  onPlan: () => void
  plannedOn: string[]
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({
    id: `step:${context.step.id}`,
    data: { kind: 'step', context },
  })
  return (
    <li
      className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5"
      data-testid={`day-step-${context.step.id}`}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.8 : undefined }}
    >
      <div className="flex min-w-0 flex-1 cursor-grab touch-none flex-col" {...listeners} {...attributes}>
        <Typography className="truncate" variant="bodySm">
          {context.step.title}
        </Typography>
        <Typography className="truncate" tone="muted" variant="caption">
          {context.goal.title}
          {plannedOn.length > 0 ? ` · в плане на ${plannedOn.map(formatDate).join(', ')}` : ''}
        </Typography>
      </div>
      <Button data-testid={`day-step-plan-${context.step.id}`} onClick={onPlan} size="sm" type="button" variant="outline">
        В план
      </Button>
    </li>
  )
}

/**
 * «В план» beside a step in «Цели» (task 16): today, tomorrow or another day, and an optional
 * time. The task takes the step's name and its estimate as the length.
 */
export function PlanStepButton({ context }: { context: StepContext }) {
  const { today } = useToday()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(today)
  const [time, setTime] = useState<number | null>(null)
  const create = useCreateTaskMutation()
  const plans = useStepPlansQuery()
  const plannedOn = (plans.data?.plans ?? [])
    .filter((plan) => plan.stepId === context.step.id)
    .map((plan) => plan.scheduledOn)

  const plan = () =>
    create.mutate(
      {
        scheduledOn: date,
        title: context.step.title,
        stepId: context.step.id,
        startMinute: time,
        priority: 'normal',
      },
      {
        onSuccess: () => {
          setOpen(false)
          toast(`«${context.step.title}» — в плане на ${formatDate(date)}`)
        },
      },
    )

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          data-testid={`step-plan-${context.step.id}`}
          size="sm"
          title={plannedOn.length > 0 ? `В плане на ${plannedOn.map(formatDate).join(', ')}` : undefined}
          type="button"
          variant="ghost"
        >
          {plannedOn.length > 0 ? `В плане · ${formatDate(plannedOn[0]!)}` : 'В план'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-3">
        <Typography variant="bodySmMedium">«{context.step.title}» в план</Typography>
        <div className="flex flex-wrap gap-1">
          <Button onClick={() => setDate(today)} size="sm" type="button" variant={date === today ? 'secondary' : 'ghost'}>
            Сегодня
          </Button>
          <Button
            onClick={() => setDate(shiftDay(today, 1))}
            size="sm"
            type="button"
            variant={date === shiftDay(today, 1) ? 'secondary' : 'ghost'}
          >
            Завтра
          </Button>
        </div>
        <Field>
          <FieldLabel>День</FieldLabel>
          <DateField data-testid="step-plan-date" min={today} onChange={(value) => value && setDate(value)} value={date} />
        </Field>
        <Field>
          <FieldLabel>Время, если нужно</FieldLabel>
          <TimeField data-testid="step-plan-time" onChange={setTime} placeholder="без времени" value={time} />
        </Field>
        {create.isError ? (
          <Typography tone="destructive" variant="caption">
            {describeApiError(create.error, 'Не получилось. Попробуй ещё раз.')}
          </Typography>
        ) : null}
        <Button data-testid="step-plan-submit" disabled={create.isPending} onClick={plan} type="button">
          Поставить в план
        </Button>
      </PopoverContent>
    </Popover>
  )
}
