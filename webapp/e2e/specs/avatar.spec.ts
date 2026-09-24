import type { Page } from '@playwright/test'

import {
  jpegImage,
  pngImage,
  storageUploadUrlPatterns,
} from '../helpers/images'
import { e2ePassword, expect, test, uniqueEmail } from '../helpers/test'

/**
 * The upload journey end to end, through a real browser and a real storage endpoint.
 *
 * `bun run e2e:webapp` runs this against the filesystem driver, so it needs no Docker beyond the
 * test database. `bun run e2e:webapp:s3` runs the identical spec against the local SeaweedFS
 * container. Both must pass: that is what proves a project can develop locally and deploy to a
 * real bucket without changing product code.
 */

async function registerAndOpenProfile(page: Page) {
  const email = uniqueEmail('avatar-e2e')

  await page.goto('/signup')
  await page.getByTestId('signup-display-name').fill('Avatar E2E User')
  await page.getByTestId('signup-email').fill(email)
  await page.getByTestId('signup-password').fill(e2ePassword)
  await page.getByTestId('signup-confirm-password').fill(e2ePassword)
  await page.getByTestId('signup-submit').click()
  await expect(page).toHaveURL(/\/app$/)

  await page.getByTestId('account-menu-trigger').click()
  await page.getByTestId('nav-profile').click()
  await expect(page).toHaveURL(/\/app\/settings\/profile$/)
  await expect(page.getByTestId('profile-page')).toBeVisible()
  await expect(page.getByTestId('avatar-fallback')).toBeVisible()

  return email
}

function avatarImage(page: Page) {
  return page.getByTestId('avatar-preview').locator('img')
}

async function pickFile(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  await page.getByTestId('avatar-file-input').setInputFiles(file)
}

test('uploads an avatar, keeps it across a reload, replaces it, and removes it', async ({
  page,
}) => {
  await registerAndOpenProfile(page)

  await pickFile(page, pngImage)
  await expect(page.getByTestId('avatar-notice')).toBeVisible()
  await expect(avatarImage(page)).toBeVisible()

  // Survives a reload, which is what distinguishes a stored object from a local preview.
  await page.reload()
  await expect(page.getByTestId('profile-page')).toBeVisible()
  await expect(avatarImage(page)).toBeVisible()

  await pickFile(page, jpegImage)
  await expect(page.getByTestId('avatar-notice')).toBeVisible()
  await expect(avatarImage(page)).toBeVisible()

  await page.getByTestId('avatar-remove').click()
  await expect(page.getByTestId('avatar-notice')).toBeVisible()
  await expect(avatarImage(page)).toHaveCount(0)
  await expect(page.getByTestId('avatar-fallback')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('profile-page')).toBeVisible()
  await expect(avatarImage(page)).toHaveCount(0)
})

test('recovers from an interrupted upload when the user tries again', async ({ page }) => {
  await registerAndOpenProfile(page)

  // Kill the direct transfer, leaving a pending upload with nothing stored behind it.
  for (const pattern of storageUploadUrlPatterns) {
    await page.route(pattern, (route) =>
      route.request().method() === 'PUT' ? route.abort('failed') : route.continue(),
    )
  }

  await pickFile(page, pngImage)
  await expect(page.getByTestId('avatar-error')).toBeVisible()
  await expect(avatarImage(page)).toHaveCount(0)

  for (const pattern of storageUploadUrlPatterns) {
    await page.unroute(pattern)
  }

  // The retry gets a fresh write-once key, so it succeeds rather than colliding with the
  // abandoned one.
  await pickFile(page, pngImage)
  await expect(page.getByTestId('avatar-notice')).toBeVisible()
  await expect(avatarImage(page)).toBeVisible()

  await page.reload()
  await expect(avatarImage(page)).toBeVisible()
})
