import type { TaskDto } from '@dilife/contracts'
import { Link } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { findStep, useGoalTreeQuery, useUpdateStepMutation } from '@/features/goals'
import { useUpdateTaskMutation } from './queries'

/**
 * The one way a task is ticked off, on the day plan and on «Сегодня» alike (task 16). A task of
 * a goal step asks whether the step is done as a whole: a step that takes several days is not
 * closed by one day's work, so the app asks instead of deciding. A step of a closed goal, or of
 * one in the trash, is not asked about.
 */
export function useCompleteTask(): {
  setCompleted: (task: TaskDto, completed: boolean) => void
  isPending: boolean
  dialog: ReactNode
} {
  const update = useUpdateTaskMutation()
  const updateStep = useUpdateStepMutation()
  const tree = useGoalTreeQuery()
  const [asking, setAsking] = useState<TaskDto | null>(null)

  const context = asking ? findStep(tree.data?.goals ?? [], asking.stepId) : null

  const setCompleted = (task: TaskDto, completed: boolean) => {
    update.mutate(
      { taskId: task.id, input: { isCompleted: completed } },
      {
        onSuccess: () => {
          if (!completed || task.stepId === null) return
          const found = findStep(tree.data?.goals ?? [], task.stepId)
          if (found && found.goal.status === 'active' && found.step.completedAt === null) {
            setAsking(task)
          }
        },
      },
    )
  }

  const closeStep = () => {
    if (!context) return
    updateStep.mutate(
      { stepId: context.step.id, input: { isCompleted: true } },
      {
        onSuccess: ({ goal }) => {
          setAsking(null)
          if (goal.progressMode === 'manual') {
            // A manual goal's number is the person's own: the step does not move it (task 08).
            toast('Шаг отмечен', {
              description: 'Эта цель считается вручную. Запиши новое значение в «Целях».',
            })
          } else {
            toast('Шаг отмечен', {
              description: `Цель «${goal.title}»: ${Math.round((goal.progressRatio ?? 0) * 100)}%`,
            })
          }
        },
        onError: () => toast.error('Шаг не отметился. Отметь его в «Целях».'),
      },
    )
  }

  const dialog = (
    <Dialog onOpenChange={(open) => (open ? undefined : setAsking(null))} open={asking !== null}>
      <DialogContent data-testid="step-done-dialog">
        <DialogHeader>
          <DialogTitle>Шаг выполнен целиком?</DialogTitle>
          <DialogDescription>
            {context
              ? `«${context.step.title}» — шаг цели «${context.goal.title}». Если он сделан до конца, отметим его в цели.`
              : ''}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button onClick={() => setAsking(null)} type="button" variant="ghost">
            Нет, продолжу в другой день
          </Button>
          {context?.goal.progressMode === 'manual' ? (
            <Button asChild variant="outline">
              <Link search={{ goal: context.goal.id, view: undefined }} to="/app/goals">
                Открыть цель
              </Link>
            </Button>
          ) : null}
          <Button
            data-testid="step-done-yes"
            disabled={updateStep.isPending}
            onClick={closeStep}
            type="button"
          >
            Да, шаг выполнен
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { setCompleted, isPending: update.isPending, dialog }
}
