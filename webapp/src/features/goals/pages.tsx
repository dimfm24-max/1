import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { CreateGoalForm } from './CreateGoalForm'
import { GoalCard } from './GoalCard'
import { LifeGoalPanel } from './LifeGoalPanel'
import { useGoalTreeQuery } from './queries'

export function GoalsPage() {
  const tree = useGoalTreeQuery()
  // One clock for the whole render, so two cards can never disagree about what today is.
  const now = new Date()

  if (tree.isPending) {
    return (
      <section className="flex min-h-48 items-center justify-center" data-testid="goals-loading">
        <Spinner />
      </section>
    )
  }

  if (tree.isError) {
    return (
      <Alert data-testid="goals-error" variant="destructive">
        <AlertTitle>Не удалось загрузить цели</AlertTitle>
        <AlertDescription>
          Проверьте соединение и обновите страницу.
        </AlertDescription>
      </Alert>
    )
  }

  const { lifeGoal, goals } = tree.data
  const active = goals.filter((goal) => goal.status === 'active')
  const closed = goals.filter((goal) => goal.status !== 'active')

  return (
    <section className="flex flex-col gap-6 p-4 md:p-6" data-testid="goals-page">
      <LifeGoalPanel lifeGoal={lifeGoal} />
      <CreateGoalForm disabled={lifeGoal === null} />

      <div className="flex flex-col gap-4">
        <Typography as="h2" variant="h6">
          Цели в работе
        </Typography>
        {active.length === 0 ? (
          <Typography tone="muted" variant="bodySm" data-testid="goals-empty">
            Пока ни одной цели. Первая созданная станет главной — её видно на экране дня.
          </Typography>
        ) : (
          active.map((goal) => <GoalCard goal={goal} key={goal.id} now={now} />)
        )}
      </div>

      {closed.length === 0 ? null : (
        <div className="flex flex-col gap-4" data-testid="goals-archive">
          <Typography as="h2" variant="h6">
            Архив
          </Typography>
          {closed.map((goal) => (
            <GoalCard goal={goal} key={goal.id} now={now} />
          ))}
        </div>
      )}
    </section>
  )
}
