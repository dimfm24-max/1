import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { AccountSummary } from '../src/features/users/AccountSummary'

test('account summary reports identity without advertising payments', () => {
  const markup = renderToStaticMarkup(
    <AccountSummary
      user={{
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'Demo User',
        createdAt: '2026-07-20T00:00:00.000Z',
      }}
    />,
  )

  expect(markup).toContain('Demo User')
  expect(markup).toContain('user@example.com')
  expect(markup).not.toContain('Subscription')
})
