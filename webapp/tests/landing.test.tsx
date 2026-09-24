import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { LandingPage } from '../src/features/landing'

test('a visitor sent here from a protected page keeps that destination through sign-up', () => {
  // The guard sends a guest to `/` with the page they wanted. Losing it here would drop them on
  // the workspace home after signing up, which is the whole point of carrying it.
  const markup = renderToStaticMarkup(<LandingPage returnTo="/app/goals?focus=1" />)

  expect(markup).toContain('href="/signup?returnTo=%2Fapp%2Fgoals%3Ffocus%3D1"')
  expect(markup).toContain('href="/login?returnTo=%2Fapp%2Fgoals%3Ffocus%3D1"')
})

test('a visitor arriving on their own gets the plain entrances', () => {
  const markup = renderToStaticMarkup(<LandingPage />)

  expect(markup).toContain('href="/signup"')
  expect(markup).toContain('href="/login"')
  expect(markup).not.toContain('returnTo')
})
