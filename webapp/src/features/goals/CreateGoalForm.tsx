import { useId, useState, type FormEvent } from 'react'

import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useCreateGoalMutation } from './queries'

/**
 * A new goal asks for four things and no more: what, by when, in what units, and how much. The
 * deadline is required because the product counts down to it, and the unit is the person's own
 * word so the number on the card reads like something they said.
 */
export function CreateGoalForm({ disabled }: { disabled: boolean }) {
  const titleId = useId()
  const deadlineId = useId()
  const unitId = useId()
  const targetId = useId()
  const modeId = useId()
  const [title, setTitle] = useState('')
  const [deadline, setDeadline] = useState('')
  const [measureUnit, setMeasureUnit] = useState('')
  const [targetValue, setTargetValue] = useState('')
  const [progressMode, setProgressMode] = useState<'manual' | 'automatic'>('manual')
  const mutation = useCreateGoalMutation()

  const target = Number(targetValue)
  const isComplete =
    title.trim() !== '' &&
    deadline !== '' &&
    measureUnit.trim() !== '' &&
    targetValue !== '' &&
    Number.isFinite(target) &&
    target >= 0

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isComplete || disabled) return
    mutation.mutate(
      {
        title: title.trim(),
        // A date input gives a day, not a moment. The end of that day is what a person means by
        // "by the 30th", so the countdown does not expire the goal a day early.
        deadline: new Date(`${deadline}T23:59:59.000Z`).toISOString(),
        measureUnit: measureUnit.trim(),
        targetValue: target,
        progressMode,
      },
      {
        onSuccess: () => {
          setTitle('')
          setDeadline('')
          setMeasureUnit('')
          setTargetValue('')
          setProgressMode('manual')
        },
      },
    )
  }

  return (
    <Card data-testid="create-goal-form">
      <CardHeader>
        <Typography as="h2" variant="h6">
          Новая цель
        </Typography>
        <CardDescription>
          {disabled
            ? 'Сначала назовите дело вашей жизни — цели живут под ним.'
            : 'Большая цель делится на этапы, этапы — на шаги.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={titleId}>Цель</FieldLabel>
              <Input
                data-testid="goal-title"
                disabled={disabled}
                id={titleId}
                maxLength={200}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Например: пробежать марафон"
                value={title}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={deadlineId}>Срок</FieldLabel>
              <Input
                data-testid="goal-deadline"
                disabled={disabled}
                id={deadlineId}
                onChange={(event) => setDeadline(event.target.value)}
                type="date"
                value={deadline}
              />
              <FieldDescription>Срок обязателен: до него идёт обратный отсчёт.</FieldDescription>
            </Field>
          </FieldGroup>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={unitId}>В чём измеряете</FieldLabel>
              <Input
                data-testid="goal-unit"
                disabled={disabled}
                id={unitId}
                maxLength={40}
                onChange={(event) => setMeasureUnit(event.target.value)}
                placeholder="километров, страниц, занятий"
                value={measureUnit}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={targetId}>Сколько нужно</FieldLabel>
              <Input
                data-testid="goal-target"
                disabled={disabled}
                id={targetId}
                min={0}
                onChange={(event) => setTargetValue(event.target.value)}
                type="number"
                value={targetValue}
              />
            </Field>
          </FieldGroup>

          <Field>
            <FieldLabel htmlFor={modeId}>Как считать продвижение</FieldLabel>
            <NativeSelect
              data-testid="goal-mode"
              disabled={disabled}
              id={modeId}
              onChange={(event) =>
                setProgressMode(event.target.value === 'automatic' ? 'automatic' : 'manual')
              }
              value={progressMode}
            >
              <option value="manual">Записываю сам</option>
              <option value="automatic">Считать по выполненным шагам</option>
            </NativeSelect>
          </Field>

          <Button
            className="self-start"
            data-testid="goal-submit"
            disabled={disabled || !isComplete || mutation.isPending}
            type="submit"
          >
            Создать цель
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
