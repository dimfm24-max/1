import type { IconSvgElement } from '@hugeicons/react'
import { HugeiconsIcon } from '@hugeicons/react'

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Typography } from '@/components/typography'
import type { WorkspaceRoutePath } from '@/features/navigation'
import { DashboardLink } from './DashboardLink'

export type DashboardNavigationItem = {
  icon: IconSvgElement
  id: string
  isActive: boolean
  label: string
  to: WorkspaceRoutePath
}

/**
 * One block of menu links. `bottom` pins the block to the foot of the sidebar, which is where
 * the account and sharing screens live, apart from the sections a day is lived in.
 */
export function NavMain({
  items,
  label,
  placement = 'top',
  testId,
}: {
  items: ReadonlyArray<DashboardNavigationItem>
  label: string
  placement?: 'top' | 'bottom'
  testId?: string
}) {
  return (
    <nav
      aria-label={label}
      className={placement === 'bottom' ? 'mt-auto' : undefined}
      data-testid={testId}
    >
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
            {items.map((item) => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton
                  asChild
                  className="h-10 gap-3 px-3 [&_svg]:size-5"
                  isActive={item.isActive}
                  tooltip={item.label}
                >
                  <DashboardLink data-testid={`nav-${item.id}`} to={item.to}>
                    <HugeiconsIcon
                      className="group-data-[active=true]/menu-button:text-sidebar-primary"
                      icon={item.icon}
                      strokeWidth={1.8}
                    />
                    <Typography asChild variant="control">
                      <span>{item.label}</span>
                    </Typography>
                  </DashboardLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </nav>
  )
}
