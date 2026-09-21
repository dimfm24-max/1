import { expect, test } from 'bun:test'

import {
  homePath,
  resolveDestination,
  safeReturnPath,
  workspaceNavigationItems,
  workspaceRoutes,
} from '../src/features/navigation/model'
import { router } from '../src/routes'

test('navigation exposes only workspace paths', () => {
  // Asserted as a boundary, not as a list: a new menu entry is a product decision, while a path
  // outside the workspace reachable from the menu is a bug.
  expect(workspaceNavigationItems().every((item) => item.to.startsWith('/app'))).toBe(true)
  expect(homePath).toBe('/app')
})

test('destinations outside the workspace resolve to its home', () => {
  expect(resolveDestination('/app/profile')).toBe('/app/profile')
  expect(resolveDestination('/login')).toBe('/app')
  expect(resolveDestination('/unknown')).toBe('/app')
})

test('workspace route table matches the routes registered under the workspace layout', () => {
  // `WorkspaceRoute` in `src/pages.tsx` guards this layout id. Every path registered below it is
  // a protected route that must survive a login round-trip whether or not it is in the sidebar,
  // so the return-path allow-list is pinned to the router, not to the menu.
  const layoutId = '/userWorkspace'
  const registered: string[] = []

  for (const route of Object.values(router.routesById)) {
    if (typeof route.path !== 'string') continue
    let layout = route.parentRoute
    while (layout && layout.id !== layoutId) layout = layout.parentRoute
    if (!layout) continue
    registered.push(route.fullPath)
  }

  expect(registered.toSorted()).toEqual([...workspaceRoutes].toSorted())
})

test('workspace route table uses only route shapes the return-path matcher understands', () => {
  // The matcher knows literal segments and named `$param` segments. Any other TanStack shape (a
  // bare `$` splat, `{-$optional}`, prefixed params) would silently send the return path to the
  // home page, so registering one must fail here, next to the table it would have to join.
  const supportedSegment = /^(\$[A-Za-z_]\w*|[^${}]+)$/

  for (const pattern of workspaceRoutes) {
    for (const segment of pattern.split('/').slice(1)) {
      expect(segment).toMatch(supportedSegment)
    }
  }
})

test('every protected route round-trips as a return path', () => {
  for (const path of workspaceRoutes) {
    expect(safeReturnPath(path)).toBe(path)
  }
  expect(safeReturnPath('/app/profile?tab=photo')).toBe('/app/profile?tab=photo')
})

test('parameterised protected routes round-trip', () => {
  const routes = ['/app', '/app/projects/$projectId']

  expect(safeReturnPath('/app/projects/42?tab=files', routes)).toBe('/app/projects/42?tab=files')
  // A parameter must be present, non-empty, and a single segment.
  expect(safeReturnPath('/app/projects', routes)).toBeNull()
  expect(safeReturnPath('/app/projects/', routes)).toBeNull()
  expect(safeReturnPath('/app/projects/42/extra', routes)).toBeNull()
})

test('route shapes the matcher does not support fall back to the home page', () => {
  // A bare `$` splat and an optional param are registered in TanStack syntax but not understood
  // here; they must never match, so the login round-trip lands on the home page, not off-site.
  const routes = ['/app/files/$', '/app/docs/{-$docId}']

  expect(safeReturnPath('/app/files/a', routes)).toBeNull()
  expect(safeReturnPath('/app/files/a/b', routes)).toBeNull()
  expect(safeReturnPath('/app/docs', routes)).toBeNull()
  expect(safeReturnPath('/app/docs/1', routes)).toBeNull()
})

test('return paths reject public pages and every open-redirect shape', () => {
  expect(safeReturnPath('/')).toBeNull()
  expect(safeReturnPath('/login')).toBeNull()
  expect(safeReturnPath('/forgot-password')).toBeNull()
  expect(safeReturnPath('/app/unknown')).toBeNull()
  expect(safeReturnPath('/app/profile/extra')).toBeNull()

  expect(safeReturnPath(undefined)).toBeNull()
  expect(safeReturnPath('')).toBeNull()
  expect(safeReturnPath('app')).toBeNull()
  expect(safeReturnPath('https://attacker.example/app')).toBeNull()
  expect(safeReturnPath('javascript:alert(1)')).toBeNull()
  expect(safeReturnPath('//attacker.example/app')).toBeNull()
  expect(safeReturnPath('/\\attacker.example/app')).toBeNull()
  expect(safeReturnPath('\\\\attacker.example/app')).toBeNull()
  expect(safeReturnPath('/%5C%5Cattacker.example/app')).toBeNull()
  expect(safeReturnPath('/app%2F..%2F%2Fattacker.example')).toBeNull()
})
