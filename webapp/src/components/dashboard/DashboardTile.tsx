import type { ReactNode } from 'react'

import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card'
import { Typography } from '@/components/typography'

/**
 * A card with a small capital label on top, holding one number, one list or one message. A
 * feature passes the label and the content; the surface, padding and label style stay here, so
 * a screen of tiles reads as one set.
 */
export function DashboardTile({
  action,
  children,
  label,
  testId,
}: {
  action?: ReactNode
  children: ReactNode
  label: string
  testId?: string
}) {
  return (
    <Card className="h-full gap-4" data-testid={testId}>
      <CardHeader>
        <Typography as="h2" tone="muted" variant="eyebrow">
          {label}
        </Typography>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">{children}</CardContent>
    </Card>
  )
}
