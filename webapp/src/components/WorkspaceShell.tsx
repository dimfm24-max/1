import {
  Calendar01Icon,
  ChartLineData01Icon,
  HourglassIcon,
  Note01Icon,
  RepeatIcon,
  Settings01Icon,
  Sun03Icon,
  Target02Icon,
  TaskDaily01Icon,
} from '@hugeicons/core-free-icons'
import { useLocation } from '@tanstack/react-router'
import type { UserDto } from '@dilife/contracts'
import type { PropsWithChildren, ReactNode } from 'react'

import {
  AccountMenu,
  AppSidebar,
  type DashboardNavigationItem,
  SiteHeader,
} from '@/components/dashboard'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { homePath, workspaceNavigationItems } from '@/features/navigation'

const iconsByPath = {
  '/app': Sun03Icon,
  '/app/day': TaskDaily01Icon,
  '/app/goals': Target02Icon,
  '/app/habits': RepeatIcon,
  '/app/horizon': HourglassIcon,
  '/app/statistics': ChartLineData01Icon,
  '/app/notes': Note01Icon,
  '/app/calendar': Calendar01Icon,
  '/app/settings': Settings01Icon,
} as const

function getSidebarDefaultOpen() {
  const persistedState = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('sidebar_state='))
    ?.slice('sidebar_state='.length)

  return persistedState !== 'false'
}

/** The menu item a path belongs to: its own, or the section it sits under (`/app/settings/…`). */
function activeItemFor(pathname: string) {
  const items = workspaceNavigationItems()
  return (
    items.find((item) => item.to === pathname) ??
    items.find((item) => item.to !== '/app' && pathname.startsWith(`${item.to}/`))
  )
}

export function WorkspaceShell({
  avatarUrl,
  children,
  headerActions,
  onLogout,
  user,
}: PropsWithChildren<{
  avatarUrl: string | null
  /** Search and notifications, placed before the profile when they are available. */
  headerActions?: ReactNode
  onLogout: () => Promise<void>
  user: UserDto
}>) {
  const pathname = useLocation({ select: (location) => location.pathname })
  const navigationItems = workspaceNavigationItems()
  const activeItem = activeItemFor(pathname)
  const toMenuItem = (item: (typeof navigationItems)[number]): DashboardNavigationItem => ({
    icon: iconsByPath[item.to],
    id: item.id,
    isActive: item.id === activeItem?.id,
    label: item.label,
    to: item.to,
  })

  return (
    <SidebarProvider defaultOpen={getSidebarDefaultOpen()}>
      <AppSidebar
        homePath={homePath}
        items={navigationItems.filter((item) => item.group === 'main').map(toMenuItem)}
        serviceItems={navigationItems.filter((item) => item.group === 'service').map(toMenuItem)}
      />
      <SidebarInset>
        <SiteHeader title={activeItem?.label ?? 'DiLife'}>
          {headerActions}
          <AccountMenu
            avatarUrl={avatarUrl}
            onLogout={onLogout}
            settingsPath="/app/settings"
            user={user}
          />
        </SiteHeader>
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
