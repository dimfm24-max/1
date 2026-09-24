import { useState } from 'react'

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
import { OverdueGoalsReview, useOverdueGoals } from '@/features/goals'
import { useToday } from '@/features/settings'

const dismissedKey = 'dilife_review_dismissed'

function readDismissed(): string | null {
  try {
    return window.sessionStorage.getItem(dismissedKey)
  } catch {
    return null
  }
}

function writeDismissed(day: string) {
  try {
    window.sessionStorage.setItem(dismissedKey, day)
  } catch {
    // Blocked storage: the review may come back on the next render of the workspace, which is
    // the cautious side for questions that need an answer.
  }
}

/**
 * The one review screen on entry (tasks 09, 20, 21): everything that waits for a decision, in
 * sections, instead of several windows in a row. Closing it without answering puts it off until
 * the next time the app is opened; nothing is decided for the person.
 */
export function ReviewDialog() {
  const { today } = useToday()
  const overdue = useOverdueGoals(today)
  const [dismissed, setDismissed] = useState(readDismissed)
  const hasWork = overdue.length > 0
  const open = hasWork && dismissed !== today

  const later = () => {
    writeDismissed(today)
    setDismissed(today)
  }

  return (
    <Dialog onOpenChange={(next) => (next ? undefined : later())} open={open}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg" data-testid="review-dialog">
        <DialogHeader>
          <DialogTitle>Разберём, что ждёт решения</DialogTitle>
          <DialogDescription>Пара минут — и можно спокойно начинать день.</DialogDescription>
        </DialogHeader>
        <OverdueGoalsReview goals={overdue} today={today} />
        <DialogFooter>
          <Typography tone="muted" variant="caption">
            Если закрыть, спросим в следующий раз.
          </Typography>
          <Button data-testid="review-later" onClick={later} type="button" variant="ghost">
            Позже
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
