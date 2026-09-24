import type { Page } from '@playwright/test'
import { e2ePassword, expect, test, uniqueEmail } from '../helpers/test'

test('registers, restores the session, opens protected UI, and logs out', async ({ page }) => {
  const email = uniqueEmail()
  const displayName = 'Web E2E User'

  await page.goto('/signup')

  const signupPassword = page.getByTestId('signup-password')
  await expect(signupPassword).toBeVisible()
  const signupPasswordGuidanceIds = (await signupPassword.getAttribute('aria-describedby'))
    ?.split(/\s+/)
    .filter(Boolean) ?? []
  expect(signupPasswordGuidanceIds).not.toHaveLength(0)
  for (const guidanceId of signupPasswordGuidanceIds) {
    const guidance = page.locator(`[id="${guidanceId}"]`)
    await expect(guidance).toHaveCount(1)
    await expect(guidance).toContainText(/\S/)
  }
  await page.getByTestId('signup-display-name').fill(displayName)
  await page.getByTestId('signup-email').fill(email)
  await signupPassword.fill(e2ePassword)
  await expect(signupPassword).toHaveAttribute('type', 'password')
  await page.getByTestId('signup-password-toggle').click()
  await expect(signupPassword).toHaveAttribute('type', 'text')
  await expect(signupPassword).toHaveValue(e2ePassword)
  await page.getByTestId('signup-password-toggle').click()
  await expect(signupPassword).toHaveAttribute('type', 'password')
  await page.getByTestId('signup-confirm-password').fill(e2ePassword)
  await page.getByTestId('signup-submit').click()

  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByTestId('workspace-nav')).toBeVisible()
  await expect(page.getByTestId('today-page')).toBeVisible()
  await expect(page.getByTestId('account-menu-trigger')).toContainText(email)
  await expect
    .poll(async () =>
      (await page.context().cookies()).some(
        (cookie) => cookie.name === 'vibe_refresh' && cookie.httpOnly,
      ),
    )
    .toBe(true)

  const refreshAfterReload = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/auth/refresh') && response.request().method() === 'POST',
  )
  const meAfterReload = page.waitForResponse(
    (response) => response.url().endsWith('/api/auth/me') && response.request().method() === 'GET',
  )

  await page.reload()

  await expect((await refreshAfterReload).status()).toBe(200)
  await expect((await meAfterReload).status()).toBe(200)
  await expect(page.getByTestId('today-page')).toBeVisible()
  await expect(page.getByTestId('account-menu-trigger')).toContainText(displayName)

  await page.getByTestId('account-menu-trigger').click()
  await page.getByTestId('nav-profile').click()
  await expect(page.getByTestId('profile-email')).toHaveAttribute('readonly', '')
  await page.getByTestId('profile-display-name').fill('  Updated Web User  ')
  await page.getByTestId('profile-save').click()
  await expect(page.getByTestId('profile-saved')).toBeVisible()
  await expect(page.getByTestId('profile-display-name')).toHaveValue('Updated Web User')
  await page.reload()
  await expect(page.getByTestId('profile-display-name')).toHaveValue('Updated Web User')

  await logoutFromAccountMenu(page)
  await expect(page.getByTestId('login-submit')).toBeVisible()
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(e2ePassword)
  await page.getByTestId('login-submit').click()
  await expect(page).toHaveURL(/\/app\/settings\/profile$/)
  await expect(page.getByTestId('profile-display-name')).toHaveValue('Updated Web User')
})

test('shows generic forgot-password success and handles an invalid reset link', async ({ page }) => {
  await page.goto('/login')
  await page.getByTestId('login-forgot-link').click()
  await expect(page).toHaveURL(/\/forgot-password$/)

  await page.getByTestId('forgot-submit').click()
  await expect(page.getByTestId('forgot-email')).toHaveAttribute('aria-invalid', 'true')
  await page.getByTestId('forgot-email').fill(uniqueEmail('unknown-reset'))
  await page.getByTestId('forgot-submit').click()
  await expect(page.getByTestId('forgot-accepted')).toBeVisible()

  await page.goto('/reset-password#token=truncated')
  await expect(page).toHaveURL(/\/reset-password$/)
  await expect(page.getByTestId('form-error')).toBeVisible()
  await expect(page.getByTestId('reset-submit')).toBeDisabled()
})

test('keeps one logical browser session active across concurrent tabs', async ({ page }) => {
  const email = uniqueEmail('web-e2e-tabs')

  await page.goto('/signup')
  await page.getByTestId('signup-email').fill(email)
  await page.getByTestId('signup-password').fill(e2ePassword)
  await page.getByTestId('signup-confirm-password').fill(e2ePassword)
  await page.getByTestId('signup-submit').click()
  await expect(page).toHaveURL(/\/app$/)

  const secondPage = await page.context().newPage()
  await secondPage.goto('/')
  await expect(secondPage).toHaveURL(/\/app$/)

  await Promise.all([page.reload(), secondPage.reload()])

  await expect(page).toHaveURL(/\/app$/)
  await expect(secondPage).toHaveURL(/\/app$/)
  await expect(page.getByTestId('account-menu-trigger')).toContainText(email)
  await expect(secondPage.getByTestId('account-menu-trigger')).toContainText(email)

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'Temporary logout failure' } }),
    })
  })
  await logoutFromAccountMenu(page)
  await expect(page.getByTestId('logout-error')).toBeVisible()

  await logoutFromAccountMenu(secondPage)
  await expect(secondPage.getByTestId('login-submit')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('remote logout recovers a tab from a transient bootstrap error', async ({ page }) => {
  const email = uniqueEmail('web-e2e-bootstrap-logout')

  await page.goto('/signup')
  await page.getByTestId('signup-email').fill(email)
  await page.getByTestId('signup-password').fill(e2ePassword)
  await page.getByTestId('signup-confirm-password').fill(e2ePassword)
  await page.getByTestId('signup-submit').click()
  await expect(page).toHaveURL(/\/app$/)

  const healthyPage = await page.context().newPage()
  await healthyPage.goto('/')
  await expect(healthyPage).toHaveURL(/\/app$/)

  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'UNAVAILABLE', message: 'Temporary bootstrap failure' },
      }),
    })
  })
  await page.reload()
  await expect(page.getByTestId('session-error')).toBeVisible()

  await logoutFromAccountMenu(healthyPage)
  await expect(page.getByTestId('login-submit')).toBeVisible()
})

test('unknown routes wait for session recovery before choosing their return destination', async ({
  page,
}) => {
  const email = uniqueEmail('web-e2e-not-found')
  await page.goto('/signup')
  await page.getByTestId('signup-email').fill(email)
  await page.getByTestId('signup-password').fill(e2ePassword)
  await page.getByTestId('signup-confirm-password').fill(e2ePassword)
  await page.getByTestId('signup-submit').click()
  await expect(page).toHaveURL(/\/app$/)

  let failRefresh = true
  await page.route('**/api/auth/refresh', async (route) => {
    if (!failRefresh) {
      await route.continue()
      return
    }
    failRefresh = false
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'UNAVAILABLE', message: 'Temporary bootstrap failure' },
      }),
    })
  })

  await page.goto('/missing-page')
  await expect(page.getByTestId('session-error')).toBeVisible()
  await page.getByTestId('session-retry').click()

  await expect(page.getByTestId('not-found')).toBeVisible()
  await page.getByTestId('not-found-home').click()
  await expect(page).toHaveURL(/\/app$/)
})

test('concurrent account changes converge every tab on the winning cookie session', async ({ page }) => {
  const firstEmail = uniqueEmail('web-e2e-account-a')
  const secondEmail = uniqueEmail('web-e2e-account-b')
  const secondPage = await page.context().newPage()

  await Promise.all([page.goto('/signup'), secondPage.goto('/signup')])
  await page.getByTestId('signup-email').fill(firstEmail)
  await page.getByTestId('signup-password').fill(e2ePassword)
  await page.getByTestId('signup-confirm-password').fill(e2ePassword)
  await secondPage.getByTestId('signup-email').fill(secondEmail)
  await secondPage.getByTestId('signup-password').fill(e2ePassword)
  await secondPage.getByTestId('signup-confirm-password').fill(e2ePassword)

  await Promise.all([
    page.getByTestId('signup-submit').click(),
    secondPage.getByTestId('signup-submit').click(),
  ])

  await expect(page).toHaveURL(/\/app$/)
  await expect(secondPage).toHaveURL(/\/app$/)
  let winningEmail = ''
  await expect
    .poll(async () => {
      const [firstTabText, secondTabText] = await Promise.all([
        page.locator('body').innerText(),
        secondPage.locator('body').innerText(),
      ])
      winningEmail = [firstEmail, secondEmail].find(
        (candidate) => firstTabText.includes(candidate) && secondTabText.includes(candidate),
      ) ?? ''
      return winningEmail
    })
    .not.toBe('')
})

async function logoutFromAccountMenu(page: Page) {
  await page.getByTestId('account-menu-trigger').click()
  await page.getByTestId('account-logout').click()
}
