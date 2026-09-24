// Every path pattern registered under the workspace layout in `src/routes.tsx`, in TanStack
// syntax (`$param` segments). This is the return-path allow-list: a protected route survives the
// login round-trip whether or not the sidebar links to it. `tests/navigation.test.ts` fails when
// this table and the router drift apart.
export const workspaceRoutes = [
  '/app',
  '/app/day',
  '/app/goals',
  '/app/habits',
  '/app/horizon',
  '/app/statistics',
  '/app/notes',
  '/app/calendar',
  '/app/settings',
  '/app/settings/$section',
  // Old addresses kept so bookmarks still open: they redirect into the settings sections.
  '/app/share',
  '/app/profile',
] as const

type WorkspaceRouteTable = ReadonlyArray<string>

// Concrete, parameter-free workspace paths: the only ones a sidebar link or the home path can
// target without params. A `$param` route belongs in the table above but never in this union.
type StaticPath<T extends string> = T extends `${string}$${string}` ? never : T
export type WorkspaceRoutePath = StaticPath<(typeof workspaceRoutes)[number]>

// The sidebar menu is a presentation subset of the workspace routes; the type keeps it one.
// The seven sections of §6 in PRD.md, plus «План дня» and «Горизонт жизни», which the owner
// kept as menu items of their own (23.09.2026). Profile and sharing live inside «Настройки».
// `main` holds the sections a day is lived in; `service` sits apart at the foot of the menu.
const navigationItems = [
  { id: 'today', label: 'Сегодня', to: '/app', group: 'main' },
  { id: 'day', label: 'План дня', to: '/app/day', group: 'main' },
  { id: 'goals', label: 'Цели', to: '/app/goals', group: 'main' },
  { id: 'habits', label: 'Привычки', to: '/app/habits', group: 'main' },
  { id: 'calendar', label: 'Календарь', to: '/app/calendar', group: 'main' },
  { id: 'horizon', label: 'Горизонт жизни', to: '/app/horizon', group: 'main' },
  { id: 'statistics', label: 'Статистика', to: '/app/statistics', group: 'main' },
  { id: 'notes', label: 'Заметки', to: '/app/notes', group: 'main' },
  { id: 'settings', label: 'Настройки', to: '/app/settings', group: 'service' },
] as const satisfies ReadonlyArray<{
  id: string
  label: string
  to: WorkspaceRoutePath
  group: 'main' | 'service'
}>

export const homePath = '/app' as const

export function workspaceNavigationItems() {
  return navigationItems
}

export function resolveDestination(pathname: string): string {
  return isWorkspacePath(pathname) ? pathname : homePath
}

export function safeReturnPath(
  value: string | undefined,
  routes: WorkspaceRouteTable = workspaceRoutes,
): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null

  let url: URL
  try {
    url = new URL(value, 'https://app.invalid')
  } catch {
    return null
  }
  if (url.origin !== 'https://app.invalid') return null
  return isWorkspacePath(url.pathname, routes) ? `${url.pathname}${url.search}` : null
}

function isWorkspacePath(
  pathname: string,
  routes: WorkspaceRouteTable = workspaceRoutes,
): boolean {
  return routes.some((pattern) => matchesRoutePattern(pattern, pathname))
}

// A literal segment must match exactly; a named `$param` segment matches one non-empty segment.
// Route shapes this does not understand (a bare `$` splat, optional or prefixed params) never
// match, so such a return path falls back to the home path, which is the safe direction; extend
// the matcher when such a route is registered.
function matchesRoutePattern(pattern: string, pathname: string): boolean {
  const patternSegments = pattern.split('/')
  const pathSegments = pathname.split('/')
  if (patternSegments.length !== pathSegments.length) return false
  return patternSegments.every((segment, index) => {
    const actual = pathSegments[index] ?? ''
    const isNamedParam = segment.length > 1 && segment.startsWith('$')
    return isNamedParam ? actual !== '' : segment === actual
  })
}
