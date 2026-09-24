import {
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useRouter,
  useSearch,
} from '@tanstack/react-router'
import type { UserDto } from '@dilife/contracts'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { SettingsLayout, type SettingsSection } from '@/components/SettingsLayout'
import { ViewTabs } from '@/components/ViewTabs'
import {
  NotFoundSection,
  SessionErrorSection,
  SessionLoadingSection,
} from '@/components/WebRouteSections'
import { WorkspaceShell } from '@/components/WorkspaceShell'
import {
  AuthPageShell,
  clearLinkTokenHash,
  ForgotPasswordForm,
  LoginForm,
  RegisterForm,
  readLinkToken,
  ResetPasswordForm,
  EmailVerificationBanner,
  VerifyEmailPanel,
  useAuth,
} from '@/features/auth'
import { useAvatarImage, useAvatarQuery } from '@/features/avatar'
import { homePath, safeReturnPath } from '@/features/navigation'
import { DayPage, PlanStepButton } from '@/features/day'
import { GoalsPage } from '@/features/goals'
import { LandingPage } from '@/features/landing'
import { HabitsPage } from '@/features/habits'
import { HorizonPage, HorizonSettingsPanel } from '@/features/horizon'
import { CalendarPage } from '@/features/calendar'
import { PublicProfilePage, SharingSettingsPage } from '@/features/sharing'
import { NotesPage } from '@/features/notes'
import {
  AppearancePanel,
  DaySettingsPanel,
  TimeZonePanel,
  TimeZoneSync,
} from '@/features/settings'
import { StatisticsPage } from '@/features/statistics'
import { WizardPage } from '@/features/onboarding'
import { ReviewDialog } from '@/features/review'
import { TrashPanel } from '@/features/trash'
import { TodayPage } from '@/features/today'
import { ToneSettingsPanel } from '@/features/tone'
import { ProfileSettings } from '@/features/users'

export function HomePage() {
  const auth = useAuth()
  const { returnTo } = useSearch({ from: '/' })

  if (auth.isBootstrapping) return <SessionLoadingSection />
  if (auth.sessionError && !auth.user) {
    return <SessionErrorSection retry={auth.retrySession} />
  }
  if (auth.user) {
    return (
      <HrefRedirect
        href={safeReturnPath(returnTo) ?? homePath}
      />
    )
  }
  // A visitor who has never seen DiLife gets the explanation, not a login form: the four
  // levels are the product, and a password field explains none of them.
  return <LandingPage returnTo={returnTo} />
}

export function LoginPage() {
  const { returnTo } = useSearch({ from: '/login' })
  return (
    <GuestAuthPage returnTo={returnTo}>
      <AuthPageShell>
        <LoginForm returnTo={returnTo} />
      </AuthPageShell>
    </GuestAuthPage>
  )
}

export function SignupPage() {
  const { returnTo } = useSearch({ from: '/signup' })
  return (
    <GuestAuthPage returnTo={returnTo}>
      <AuthPageShell>
        <RegisterForm returnTo={returnTo} />
      </AuthPageShell>
    </GuestAuthPage>
  )
}

export function ForgotPasswordPage() {
  return (
    <GuestAuthPage>
      <AuthPageShell>
        <ForgotPasswordForm />
      </AuthPageShell>
    </GuestAuthPage>
  )
}

export function ResetPasswordPage() {
  const auth = useAuth()
  const token = useLinkToken()
  if (auth.isBootstrapping) return <SessionLoadingSection />

  return (
    <AuthPageShell>
      <ResetPasswordForm token={token} />
    </AuthPageShell>
  )
}

export function VerifyEmailPage() {
  const auth = useAuth()
  const token = useLinkToken()
  // Wait for the session only to pick the right way onward; the token itself needs none.
  if (auth.isBootstrapping) return <SessionLoadingSection />

  return (
    <AuthPageShell>
      <VerifyEmailPanel token={token} />
    </AuthPageShell>
  )
}

export function WelcomePage() {
  const auth = useAuth()
  const navigate = useNavigate()

  if (auth.isBootstrapping) return <SessionLoadingSection />
  if (auth.sessionError && !auth.user) {
    return <SessionErrorSection retry={auth.retrySession} />
  }
  if (!auth.user) return <HrefRedirect href="/login?returnTo=%2Fwelcome" />
  if (auth.user.onboardingCompleted !== false) return <HrefRedirect href={homePath} />
  return (
    <>
      <TimeZoneSync />
      <WizardPage
        onDone={() => void navigate({ to: '/app' })}
        onLogout={auth.logout}
        user={auth.user}
      />
    </>
  )
}

export function UserHomePage() {
  const user = useWorkspaceUser()
  return <TodayPage user={user} />
}

export function UserDayPage() {
  const { date, task } = useSearch({ from: '/userWorkspace/app/day' })
  const navigate = useNavigate()
  return (
    <DayPage
      date={date}
      highlightTaskId={task}
      onDateChange={(next) =>
        void navigate({ to: '/app/day', search: { date: next ?? undefined, task: undefined } })
      }
    />
  )
}

export function UserGoalsPage() {
  const { goal, view } = useSearch({ from: '/userWorkspace/app/goals' })
  const navigate = useNavigate()
  return (
    <GoalsPage
      highlightGoalId={goal}
      renderStepAction={(context) => <PlanStepButton context={context} />}
      onViewChange={(next) =>
        void navigate({
          to: '/app/goals',
          search: { goal: undefined, view: next === 'archive' ? 'archive' : undefined },
        })
      }
      view={view ?? 'active'}
    />
  )
}

export function UserHabitsPage() {
  return <HabitsPage />
}

export function UserHorizonPage() {
  return <HorizonPage />
}

export function UserStatisticsPage() {
  return <StatisticsPage />
}

export function UserNotesPage() {
  return <NotesPage />
}

const calendarViews = [
  { id: 'month', label: 'Месяц' },
  { id: 'horizon', label: 'Горизонт жизни' },
] as const

/** «Календарь» with its views (§6 of PRD.md); the life horizon is one of them. */
export function UserCalendarPage() {
  const { view } = useSearch({ from: '/userWorkspace/app/calendar' })
  const navigate = useNavigate()
  const active = view ?? 'month'

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="px-4 pt-4 md:px-6 md:pt-6">
        <ViewTabs
          active={active}
          label="Вид календаря"
          onSelect={(next) =>
            void navigate({
              to: '/app/calendar',
              search: { view: next === 'horizon' ? 'horizon' : undefined },
            })
          }
          tabs={calendarViews}
          testId="calendar-view"
        />
      </div>
      {active === 'horizon' ? <HorizonPage /> : <CalendarPage />}
    </div>
  )
}

export function PublicProfileRoute() {
  const { token } = useParams({ from: '/p/$token' })
  return <PublicProfilePage token={token} />
}

// The sections of «Настройки» (§6 of PRD.md). Each is composed here from its feature. A section
// appears together with the feature that fills it: notifications, categories, templates,
// quotes, fields and data arrive with their own tasks.
const settingsSections = [
  { id: 'profile', label: 'Профиль' },
  { id: 'tone', label: 'Тон' },
  { id: 'day', label: 'День' },
  { id: 'horizon', label: 'Горизонт жизни' },
  { id: 'appearance', label: 'Оформление' },
  { id: 'share', label: 'Доступ по ссылке' },
  { id: 'data', label: 'Данные' },
] as const satisfies ReadonlyArray<SettingsSection>

function SettingsPanelFrame({ children }: { children: ReactNode }) {
  return <div className="flex max-w-2xl flex-col gap-6 p-4 md:p-6">{children}</div>
}

export function UserSettingsPage() {
  const auth = useAuth()
  const user = useWorkspaceUser()
  const params = useParams({ strict: false }) as { section?: string }
  const active =
    settingsSections.find((section) => section.id === params.section)?.id ?? 'profile'

  return (
    <SettingsLayout active={active} sections={settingsSections}>
      {active === 'profile' ? (
        <ProfileSettings onLogout={auth.logout} user={user}>
          <TimeZonePanel />
        </ProfileSettings>
      ) : null}
      {active === 'tone' ? (
        <SettingsPanelFrame>
          <ToneSettingsPanel />
        </SettingsPanelFrame>
      ) : null}
      {active === 'day' ? (
        <SettingsPanelFrame>
          <DaySettingsPanel />
        </SettingsPanelFrame>
      ) : null}
      {active === 'horizon' ? (
        <SettingsPanelFrame>
          <HorizonSettingsPanel />
        </SettingsPanelFrame>
      ) : null}
      {active === 'appearance' ? (
        <SettingsPanelFrame>
          <AppearancePanel />
        </SettingsPanelFrame>
      ) : null}
      {active === 'share' ? <SharingSettingsPage /> : null}
      {active === 'data' ? (
        <SettingsPanelFrame>
          <TrashPanel />
        </SettingsPanelFrame>
      ) : null}
    </SettingsLayout>
  )
}

export function UserWorkspaceLayout() {
  return <WorkspaceRoute />
}

export function NotFoundPage() {
  const auth = useAuth()

  if (auth.isBootstrapping) return <SessionLoadingSection />
  if (auth.sessionError && !auth.user) {
    return <SessionErrorSection retry={auth.retrySession} />
  }

  const destination = auth.user ? homePath : '/login'
  return <NotFoundSection destination={destination} />
}

function WorkspaceRoute() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.isBootstrapping) return <SessionLoadingSection />
  if (auth.sessionError && !auth.user) {
    return <SessionErrorSection retry={auth.retrySession} />
  }
  if (!auth.user) {
    const returnTo = `${location.pathname}${location.searchStr}`
    return <HrefRedirect href={`/login?returnTo=${encodeURIComponent(returnTo)}`} />
  }
  // Until the first-run wizard is done every /app address opens it. A missing flag (an older
  // server) reads as done, so nobody is trapped.
  if (auth.user.onboardingCompleted === false) return <HrefRedirect href="/welcome" />
  return (
    <SignedInWorkspace onLogout={auth.logout} user={auth.user}>
      <Outlet />
    </SignedInWorkspace>
  )
}

/** The shell once a person is known: their photo in the header and the time zone kept in step. */
function SignedInWorkspace({
  children,
  onLogout,
  user,
}: {
  children: ReactNode
  onLogout: () => Promise<void>
  user: UserDto
}) {
  const avatar = useAvatarQuery()
  const avatarUrl = useAvatarImage(avatar.data?.avatar?.downloadUrl)

  return (
    <WorkspaceShell avatarUrl={avatarUrl} onLogout={onLogout} user={user}>
      <TimeZoneSync />
      <EmailVerificationBanner user={user} />
      <ReviewDialog />
      {children}
    </WorkspaceShell>
  )
}

function GuestAuthPage({
  children,
  returnTo,
}: {
  children: ReactNode
  returnTo?: string
}) {
  const auth = useAuth()

  if (auth.isBootstrapping) return <SessionLoadingSection />
  if (auth.sessionError && !auth.user) {
    return <SessionErrorSection retry={auth.retrySession} />
  }
  if (auth.user) {
    return (
      <HrefRedirect
        href={safeReturnPath(returnTo) ?? homePath}
      />
    )
  }

  return children
}

function useLinkToken() {
  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') return ''
    return readLinkToken(window.location)
  })

  useEffect(() => {
    const captureToken = () => {
      const nextToken = readLinkToken(window.location)
      if (!nextToken) return
      setToken(nextToken)
      clearLinkTokenHash(window.location, window.history)
    }

    captureToken()
    window.addEventListener('hashchange', captureToken)
    return () => window.removeEventListener('hashchange', captureToken)
  }, [])

  return token
}

function useWorkspaceUser(): UserDto {
  const user = useAuth().user
  if (!user) {
    throw new Error('Workspace page rendered outside its guarded layout')
  }
  return user
}

function HrefRedirect({ href }: { href: string }) {
  const router = useRouter()
  const hasRedirected = useRef(false)
  useEffect(() => {
    if (hasRedirected.current) return
    hasRedirected.current = true
    router.history.replace(href)
  }, [href, router])
  return null
}
