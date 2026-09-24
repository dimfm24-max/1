import type { GoalDto } from '@dilife/contracts'
import { useState } from 'react'

import { Typography } from '@/components/typography'
import { Button } from '@/components/ui/button'
import { useToneText } from '@/features/tone'
import { CloseGoalDialog, DeadlineDialog } from './GoalDialogs'
import { formatDeadline } from './goal-view'

type Answer = { goal: GoalDto; kind: 'extend' | 'completed' | 'abandoned' } | null

/**
 * One list of every overdue goal with three answers each: extend in the calendar, close with an
 * outcome, or give up with one. An answered goal leaves the list as soon as the tree updates.
 */
export function OverdueGoalsReview({ goals, today }: { goals: GoalDto[]; today: string }) {
  const [answer, setAnswer] = useState<Answer>(null)
  const say = useToneText()
  const close = (open: boolean) => {
    if (!open) setAnswer(null)
  }

  if (goals.length === 0) return null

  return (
    <section className="flex flex-col gap-3" data-testid="review-overdue-goals">
      <Typography as="h3" variant="h6">
        Срок прошёл
      </Typography>
      <ul className="flex flex-col gap-3">
        {goals.map((goal) => (
          <li className="flex flex-col gap-2 rounded-lg border p-3" key={goal.id}>
            <Typography variant="bodySmMedium">{goal.title}</Typography>
            <Typography tone="muted" variant="caption">
              Срок был {formatDeadline(goal.deadline)}. {say('deadlineOverdue', { goal: goal.title })}
            </Typography>
            <div className="flex flex-wrap gap-2">
              <Button
                data-testid={`review-extend-${goal.id}`}
                onClick={() => setAnswer({ goal, kind: 'extend' })}
                size="sm"
                type="button"
              >
                Продлить
              </Button>
              <Button
                data-testid={`review-complete-${goal.id}`}
                onClick={() => setAnswer({ goal, kind: 'completed' })}
                size="sm"
                type="button"
                variant="outline"
              >
                Закрыть
              </Button>
              <Button
                data-testid={`review-abandon-${goal.id}`}
                onClick={() => setAnswer({ goal, kind: 'abandoned' })}
                size="sm"
                type="button"
                variant="ghost"
              >
                Отказаться
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {answer?.kind === 'extend' ? (
        <DeadlineDialog goal={answer.goal} mode="extend" onOpenChange={close} open today={today} />
      ) : null}
      {answer && answer.kind !== 'extend' ? (
        <CloseGoalDialog goal={answer.goal} onOpenChange={close} open status={answer.kind} />
      ) : null}
    </section>
  )
}
