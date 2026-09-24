import type { ReactNode } from 'react'

import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Typography } from '@/components/typography'

/**
 * The header of every workspace screen (§6 of PRD.md): the name of the product, the section,
 * and on the right the search, the notifications and the profile as each becomes available.
 */
export function SiteHeader({ children, title }: { children?: ReactNode; title: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center border-b bg-background/95 backdrop-blur transition-[width,height] motion-reduce:transition-none">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          className="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        {/* On a phone the sidebar is hidden, so the header carries the product name itself. */}
        <span className="md:hidden">
          <Typography as="span" tone="primary" variant="brand">
            DiLife
          </Typography>
        </span>
        <span className="hidden min-w-0 md:block">
          <Typography as="span" truncate variant="h6">
            {title}
          </Typography>
        </span>
        {/* Children are the actions on the right: search, notifications, the profile menu. */}
        <div className="ml-auto flex items-center gap-1">{children}</div>
      </div>
    </header>
  )
}
