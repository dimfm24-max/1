import {
  Calendar03Icon,
  Home01Icon,
  ChartLineData01Icon,
  Note01Icon,
  ClockIcon,
  RepeatIcon,
  Settings01Icon,
  Target02Icon,
  UserIcon,
} from '@hugeicons/core-free-icons'
import { useLocation } from '@tanstack/react-router'
import type { UserDto } from '@dilife/contracts'
import type { PropsWithChildren } from 'react'

import {
  AppSidebar,
  type DashboardNavigationItem,
  SiteHeader,
} from '@/components/dashboard'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { homePath, workspaceNavigationItems } from '@/features/navigation'

const iconsByPath = {
  '/app': Home01Icon,
  '/app/day': Calendar03Icon,
  '/app/goals': Target02Icon,
  '/app/habits': RepeatIcon,
  '/app/horizon': ClockIcon,
  '/app/statistics': ChartLineData01Icon,
  '/app/notes': Note01Icon,
  '/app/profile': UserIcon,
  '/app/settings': Settings01Icon,
} as const

function getSidebarDefaultOpen() {
  const persistedState = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('sidebar_state='))
    ?.slice('sidebar_state='.length)

  return persistedState !== 'false'
}

export function WorkspaceShell({
  children,
  onLogout,
  user,
}: PropsWithChildren<{
  onLogout: () => Promise<void>
  user: UserDto
}>) {
  const pathname = useLocation({ select: (location) => location.pathname })
  const navigationItems = workspaceNavigationItems()
  const activeItem = navigationItems.find((item) => item.to === pathname)
  const items: ReadonlyArray<DashboardNavigationItem> = navigationItems.map((item) => ({
    ...item,
    icon: iconsByPath[item.to],
    isActive: item.to === pathname,
  }))

  return (
    <SidebarProvider defaultOpen={getSidebarDefaultOpen()}>
      <AppSidebar
        accountPath="/app/profile"
        homePath={homePath}
        items={items}
        onLogout={onLogout}
        settingsPath="/app/settings"
        user={user}
        workspaceLabel="Workspace"
      />
      <SidebarInset>
        <SiteHeader title={activeItem?.label ?? 'Home'} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
