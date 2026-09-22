import type { LifeGoalDto } from '@dilife/contracts'
import { useId, useState, type FormEvent } from 'react'

import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useUpsertLifeGoalMutation } from './queries'

/**
 * The top of the tree. It is edited in place rather than through a dialog: a person renames it
 * rarely, and a goal cannot be created until it exists, so the empty state has to invite typing
 * rather than hide behind a button.
 */
export function LifeGoalPanel({ lifeGoal }: { lifeGoal: LifeGoalDto | null }) {
  const inputId = useId()
  const mutation = useUpsertLifeGoalMutation()
  const savedTitle = lifeGoal?.title ?? ''
  const [title, setTitle] = useState(savedTitle)
  // The panel renders from a cache that writes replace, so a rename made elsewhere has to reach
  // the field. Adjusted during render rather than in an effect, which would render twice; the
  // saved value is remembered so this only fires when it actually changed, never while typing.
  const [lastSavedTitle, setLastSavedTitle] = useState(savedTitle)
  if (savedTitle !== lastSavedTitle && !mutation.isPending) {
    setLastSavedTitle(savedTitle)
    setTitle(savedTitle)
  }

  const trimmed = title.trim()
  const isUnchanged = trimmed === savedTitle

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (trimmed === '' || isUnchanged) return
    mutation.mutate(trimmed)
  }

  return (
    <Card data-testid="life-goal-panel">
      <CardHeader>
        <Typography as="h2" variant="h6">
          Дело вашей жизни
        </Typography>
        <CardDescription>
          {lifeGoal
            ? 'Всё, к чему вы идёте, собрано под этим.'
            : 'Назовите то, ради чего ставите цели. Без этого цель завести нельзя.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={submit}>
          <Field className="flex-1">
            <FieldLabel htmlFor={inputId}>Название</FieldLabel>
            <Input
              id={inputId}
              data-testid="life-goal-input"
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: быть здоровым и сильным"
              value={title}
            />
            <FieldDescription>
              {lifeGoal ? 'Можно переименовать в любой момент.' : 'Один раз, потом можно менять.'}
            </FieldDescription>
          </Field>
          <Button
            data-testid="life-goal-submit"
            disabled={trimmed === '' || isUnchanged || mutation.isPending}
            type="submit"
          >
            {lifeGoal ? 'Переименовать' : 'Сохранить'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
