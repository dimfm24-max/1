import {
  Logout01Icon,
  Settings01Icon,
  UserCircle02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import type { UserDto } from '@dilife/contracts'
import { useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Typography } from '@/components/typography'
import type { WorkspaceRoutePath } from '@/features/navigation'
import { DashboardLink } from './DashboardLink'

/**
 * The profile in the header (§6 of PRD.md): the photo, and a menu with the profile, the
 * settings and signing out. It is the only account menu in the app; the sidebar holds sections.
 */
export function AccountMenu({
  avatarUrl,
  onLogout,
  settingsPath,
  user,
}: {
  avatarUrl: string | null
  onLogout: () => Promise<void>
  settingsPath: WorkspaceRoutePath
  user: UserDto
}) {
  const [logoutError, setLogoutError] = useState(false)
  const [logoutPending, setLogoutPending] = useState(false)
  const name = user.displayName ?? user.email

  const logout = async () => {
    setLogoutError(false)
    setLogoutPending(true)
    try {
      await onLogout()
    } catch {
      setLogoutError(true)
    } finally {
      setLogoutPending(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {logoutError && (
        <Typography data-testid="logout-error" role="alert" variant="caption" tone="destructive">
          Не удалось выйти. Попробуй ещё раз.
        </Typography>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Открыть меню профиля"
            className="h-10 gap-2 px-1.5 sm:pr-3"
            data-testid="account-menu-trigger"
            variant="ghost"
          >
            <UserAvatar avatarUrl={avatarUrl} user={user} />
            <span className="hidden max-w-40 sm:block">
              <Typography as="span" truncate variant="control">
                {name}
              </Typography>
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 rounded-lg" sideOffset={6}>
          <DropdownMenuLabel className="p-0">
            <div className="flex items-center gap-2 px-1 py-1.5">
              <UserAvatar avatarUrl={avatarUrl} user={user} />
              <div className="grid min-w-0 flex-1 gap-0.5">
                <Typography variant="bodySmMedium" truncate>
                  {name}
                </Typography>
                <Typography variant="caption" tone="muted" truncate>
                  {user.email}
                </Typography>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link data-testid="nav-profile" params={{ section: 'profile' }} to="/app/settings/$section">
                <HugeiconsIcon icon={UserCircle02Icon} strokeWidth={2} />
                Профиль
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <DashboardLink data-testid="account-settings" to={settingsPath}>
                <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
                Настройки
              </DashboardLink>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            data-testid="account-logout"
            disabled={logoutPending}
            onSelect={() => void logout()}
            variant="destructive"
          >
            <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
            {logoutPending ? 'Выходим…' : 'Выйти'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function UserAvatar({ avatarUrl, user }: { avatarUrl: string | null; user: UserDto }) {
  return (
    <Avatar className="size-8">
      {avatarUrl && <AvatarImage alt="" src={avatarUrl} />}
      <AvatarFallback>{userInitials(user)}</AvatarFallback>
    </Avatar>
  )
}

function userInitials(user: UserDto) {
  return (user.displayName ?? user.email)
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}
