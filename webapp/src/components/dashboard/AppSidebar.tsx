import { Stairs01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { Typography } from '@/components/typography'
import type { WorkspaceRoutePath } from '@/features/navigation'
import { DashboardLink } from './DashboardLink'
import { NavMain, type DashboardNavigationItem } from './NavMain'

export function AppSidebar({
  homePath,
  items,
  serviceItems,
}: {
  homePath: WorkspaceRoutePath
  items: ReadonlyArray<DashboardNavigationItem>
  serviceItems: ReadonlyArray<DashboardNavigationItem>
}) {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="pt-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="DiLife">
              <DashboardLink to={homePath}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <HugeiconsIcon className="size-5!" icon={Stairs01Icon} strokeWidth={2.2} />
                </span>
                <Typography
                  className="group-data-[collapsible=icon]:hidden"
                  truncate
                  variant="brand"
                >
                  DiLife
                </Typography>
              </DashboardLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} label="Разделы" testId="workspace-nav" />
        {serviceItems.length === 0 ? null : (
          <NavMain items={serviceItems} label="Служебное" placement="bottom" />
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
