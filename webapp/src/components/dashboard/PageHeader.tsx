import type { ReactNode } from 'react'

import { Typography } from '@/components/typography'

/**
 * The top of a screen in the «Ночной старт» style: a small capital line above a large title, and
 * the screen's own controls on the right (task 45). Every section uses it, so screens line up.
 */
export function PageHeader({
  actions,
  eyebrow,
  title,
  testId,
}: {
  actions?: ReactNode
  eyebrow?: ReactNode
  title: ReactNode
  testId?: string
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3" data-testid={testId}>
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow ? (
          <Typography tone="muted" variant="eyebrow">
            {eyebrow}
          </Typography>
        ) : null}
        <Typography as="h1" variant="h2">
          {title}
        </Typography>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions ?? null}</div> : null}
    </header>
  )
}
