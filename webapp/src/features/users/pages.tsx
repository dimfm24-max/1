import type { UserDto } from '@dilife/contracts'
import type { ReactNode } from 'react'

import { AvatarPanel } from '@/features/avatar'
import { ProfilePanel } from './ProfilePanel'
import { SessionPanel } from './SessionPanel'

/** «Настройки → Профиль»: the photo, the name and the address, and signing out of this device. */
export function ProfileSettings({
  children,
  onLogout,
  user,
}: {
  /** Panels other features own, such as the time zone, placed after the name. */
  children?: ReactNode
  onLogout: () => Promise<void>
  user: UserDto
}) {
  return (
    <section className="grid w-full max-w-2xl gap-6 p-4 md:p-6" data-testid="profile-page">
      <AvatarPanel user={user} />
      <ProfilePanel user={user} />
      {children}
      <SessionPanel onLogout={onLogout} />
    </section>
  )
}
