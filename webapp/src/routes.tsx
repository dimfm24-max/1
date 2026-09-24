import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from '@tanstack/react-router'

import { RootLayout } from './root-layout'

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: lazyRouteComponent(() => import('./pages'), 'NotFoundPage'),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: typeof search.returnTo === 'string' ? search.returnTo : undefined,
  }),
  component: lazyRouteComponent(() => import('./pages'), 'HomePage'),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: returnToSearch,
  component: lazyRouteComponent(() => import('./pages'), 'LoginPage'),
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  validateSearch: returnToSearch,
  component: lazyRouteComponent(() => import('./pages'), 'SignupPage'),
})

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: lazyRouteComponent(() => import('./pages'), 'ForgotPasswordPage'),
})

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: lazyRouteComponent(() => import('./pages'), 'ResetPasswordPage'),
})

// Outside /app like /reset-password: the letter is often opened where nobody is signed in.
const verifyEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/verify-email',
  component: lazyRouteComponent(() => import('./pages'), 'VerifyEmailPage'),
})

// The first-run wizard: full screen, outside the workspace, and the only place /app leads to
// until it is done (task 07).
const welcomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/welcome',
  component: lazyRouteComponent(() => import('./pages'), 'WelcomePage'),
})

const userWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'userWorkspace',
  component: lazyRouteComponent(() => import('./pages'), 'UserWorkspaceLayout'),
})

const userHomeRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app',
  component: lazyRouteComponent(() => import('./pages'), 'UserHomePage'),
})

const userDayRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/day',
  // `/app/day?date=2026-09-23&task=<id>`: a day and, optionally, a task to point at. Anything
  // that is not a real date is dropped, and the page opens on today.
  validateSearch: (search: Record<string, unknown>): { date?: string; task?: string } => ({
    date: dayParam(search.date),
    task: idParam(search.task),
  }),
  component: lazyRouteComponent(() => import('./pages'), 'UserDayPage'),
})

const userGoalsRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/goals',
  validateSearch: (search: Record<string, unknown>): { goal?: string; view?: 'archive' } => ({
    goal: idParam(search.goal),
    view: search.view === 'archive' ? 'archive' : undefined,
  }),
  component: lazyRouteComponent(() => import('./pages'), 'UserGoalsPage'),
})

const userHabitsRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/habits',
  component: lazyRouteComponent(() => import('./pages'), 'UserHabitsPage'),
})

const userHorizonRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/horizon',
  component: lazyRouteComponent(() => import('./pages'), 'UserHorizonPage'),
})

const userStatisticsRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/statistics',
  component: lazyRouteComponent(() => import('./pages'), 'UserStatisticsPage'),
})

const userNotesRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/notes',
  component: lazyRouteComponent(() => import('./pages'), 'UserNotesPage'),
})

const userCalendarRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/calendar',
  validateSearch: (search: Record<string, unknown>): { view?: 'horizon' } => ({
    view: search.view === 'horizon' ? 'horizon' : undefined,
  }),
  component: lazyRouteComponent(() => import('./pages'), 'UserCalendarPage'),
})

// Old addresses: sharing and the profile moved into «Настройки». Kept so bookmarks still open.
const userShareRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/share',
  beforeLoad: () => {
    throw redirect({ to: '/app/settings/$section', params: { section: 'share' }, replace: true })
  },
  component: () => null,
})

// Public and outside the workspace layout: it has to open with no session at all.
const publicProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$token',
  component: lazyRouteComponent(() => import('./pages'), 'PublicProfileRoute'),
})

const userProfileRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/profile',
  beforeLoad: () => {
    throw redirect({ to: '/app/settings/$section', params: { section: 'profile' }, replace: true })
  },
  component: () => null,
})

const userSettingsRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/settings',
  component: lazyRouteComponent(() => import('./pages'), 'UserSettingsPage'),
})

const userSettingsSectionRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/settings/$section',
  component: lazyRouteComponent(() => import('./pages'), 'UserSettingsPage'),
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  verifyEmailRoute,
  welcomeRoute,
  publicProfileRoute,
  userWorkspaceRoute.addChildren([
    userHomeRoute,
    userDayRoute,
    userGoalsRoute,
    userHabitsRoute,
    userHorizonRoute,
    userStatisticsRoute,
    userNotesRoute,
    userCalendarRoute,
    userShareRoute,
    userProfileRoute,
    userSettingsRoute,
    userSettingsSectionRoute,
  ]),
])

export const router = createRouter({ routeTree })

function dayParam(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  return Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) ? undefined : value
}

function idParam(value: unknown): string | undefined {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : undefined
}

function returnToSearch(search: Record<string, unknown>) {
  return {
    returnTo: typeof search.returnTo === 'string' ? search.returnTo : undefined,
  }
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
