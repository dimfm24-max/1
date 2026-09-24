import { createHash } from 'node:crypto'
import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../../app'
import { createPrisma, type DbClient } from '../../db'
import { loadEnv } from '../../env'
import { bootstrapDevelopmentData } from '../../../scripts/development-seed'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('users API integration', () => {
  const env = loadEnv({
    DATABASE_URL: databaseUrl!,
    ACCESS_TOKEN_TTL_SECONDS: '60',
    CORS_ORIGINS: 'http://localhost:5173',
    JWT_SECRET: '12345678901234567890123456789012',
  })
  const prisma = createPrisma(databaseUrl!)
  const app = createApp({ env, prisma })

  beforeEach(async () => {
    await prisma.pushToken.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('registers users and persists profile updates', async () => {
    const session = await register('profile@example.com', 'Initial Name')

    const update = await app.request('/api/users/me', {
      method: 'PATCH',
      headers: authenticatedJsonHeaders(session.accessToken),
      body: JSON.stringify({ displayName: '  Updated Name  ' }),
    })
    const updateBody = await update.json()

    expect(update.status).toBe(200)
    expect(updateBody.user).toMatchObject({
      displayName: 'Updated Name',
      email: 'profile@example.com',
    })

    const me = await app.request('/api/auth/me', {
      headers: authenticatedHeaders(session.accessToken),
    })
    expect((await me.json()).user.displayName).toBe('Updated Name')

    const clear = await app.request('/api/users/me', {
      method: 'PATCH',
      headers: authenticatedJsonHeaders(session.accessToken),
      body: JSON.stringify({ displayName: null }),
    })
    expect((await clear.json()).user.displayName).toBeNull()

    for (const displayName of ['x', 'x'.repeat(81)]) {
      const invalid = await app.request('/api/users/me', {
        method: 'PATCH',
        headers: authenticatedJsonHeaders(session.accessToken),
        body: JSON.stringify({ displayName }),
      })
      expect(invalid.status).toBe(400)
      expect((await invalid.json()).error.code).toBe('VALIDATION_ERROR')
    }
  })

  test('a new account starts in the first-run wizard until it is marked done', async () => {
    const session = await register('wizard@example.com')
    expect(session.user.onboardingCompleted).toBe(false)

    const done = await app.request('/api/users/me/onboarding', {
      method: 'POST',
      headers: authenticatedHeaders(session.accessToken),
    })
    expect(done.status).toBe(200)
    expect((await done.json()).user.onboardingCompleted).toBe(true)
    const first = await prisma.user.findUniqueOrThrow({ where: { email: 'wizard@example.com' } })

    // Asking again keeps the first moment, and the flag comes with the account on every load.
    await app.request('/api/users/me/onboarding', {
      method: 'POST',
      headers: authenticatedHeaders(session.accessToken),
    })
    const again = await prisma.user.findUniqueOrThrow({ where: { email: 'wizard@example.com' } })
    expect(again.onboardingCompletedAt).toEqual(first.onboardingCompletedAt)
    const me = await app.request('/api/auth/me', {
      headers: authenticatedHeaders(session.accessToken),
    })
    expect((await me.json()).user.onboardingCompleted).toBe(true)

    expect((await app.request('/api/users/me/onboarding', { method: 'POST' })).status).toBe(401)
  })

  test('rejects an unauthenticated profile update', async () => {
    const response = await app.request('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Anonymous' }),
    })
    expect(response.status).toBe(401)
  })

  test('seeds a login-ready development account idempotently', async () => {
    const accounts = {
      user: {
        email: 'development-user@example.com',
        password: 'development-user-password',
      },
    }

    expect(await bootstrapDevelopmentData(prisma, accounts)).toEqual({
      user: { email: accounts.user.email },
    })
    const firstHashes = await prisma.user.findMany({
      where: { email: accounts.user.email },
      select: { email: true, passwordHash: true },
    })

    await expect(bootstrapDevelopmentData(prisma, accounts)).resolves.toEqual({
      user: { email: accounts.user.email },
    })
    expect(await prisma.user.findMany({
      where: { email: accounts.user.email },
      select: { email: true, passwordHash: true },
    })).toEqual(firstHashes)

    const response = await app.request('/api/auth/token/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accounts.user),
    })
    expect(response.status).toBe(200)
  })

  test('concurrent first development seeds converge on one account', async () => {
    const accounts = {
      user: {
        email: 'concurrent-development-user@example.com',
        password: 'concurrent-development-user-password',
      },
    }
    let userReads = 0
    let markBothUserReadsComplete: () => void = () => undefined
    const bothUserReadsComplete = new Promise<void>((resolve) => {
      markBothUserReadsComplete = resolve
    })
    let releaseUserReads: () => void = () => undefined
    const userReadBarrier = new Promise<void>((resolve) => {
      releaseUserReads = resolve
    })
    const db = prisma.$extends({
      query: {
        user: {
          async findUnique({ args, query }) {
            const result = await query(args)
            if (args.where.email === accounts.user.email && userReads < 2) {
              userReads += 1
              if (userReads === 2) markBothUserReadsComplete()
              await userReadBarrier
            }
            return result
          },
        },
      },
    }) as unknown as DbClient

    const firstSeed = bootstrapDevelopmentData(db, accounts)
    const secondSeed = bootstrapDevelopmentData(db, accounts)
    await bothUserReadsComplete
    releaseUserReads()

    await expect(Promise.all([firstSeed, secondSeed])).resolves.toEqual([
      { user: { email: accounts.user.email } },
      { user: { email: accounts.user.email } },
    ])
    expect(await prisma.user.count({
      where: { email: accounts.user.email },
    })).toBe(1)
  })

  test('replaces development user credentials and revokes stale authentication state', async () => {
    const accounts = {
      user: {
        email: 'rotated-development-user@example.com',
        password: 'initial-development-user-password',
      },
    }
    await bootstrapDevelopmentData(prisma, accounts)

    const login = await app.request('/api/auth/token/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accounts.user),
    })
    expect(login.status).toBe(200)
    const session = await login.json()
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: accounts.user.email },
      select: { id: true },
    })
    const storedSession = await prisma.authSession.findFirstOrThrow({
      where: { userId: user.id, revokedAt: null },
      select: { id: true },
    })
    await prisma.pushToken.create({
      data: {
        expoPushToken: 'ExponentPushToken[development-user-password-rotation]',
        registrationSessionId: storedSession.id,
        userId: user.id,
      },
    })
    const resetToken = 'd'.repeat(43)
    await createOutstandingPasswordResetToken(user.id, resetToken)

    const replacementPassword = 'replacement-development-user-password'
    await bootstrapDevelopmentData(prisma, {
      user: { ...accounts.user, password: replacementPassword },
    })

    expect(await app.request('/api/auth/me', {
      headers: authenticatedHeaders(session.accessToken),
    })).toHaveProperty('status', 401)
    await expectPasswordResetRejected(resetToken)
    expect(await prisma.pushToken.count({ where: { userId: user.id } })).toBe(0)

    const oldPasswordLogin = await app.request('/api/auth/token/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accounts.user),
    })
    expect(oldPasswordLogin.status).toBe(401)
    const replacementPasswordLogin = await app.request('/api/auth/token/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...accounts.user, password: replacementPassword }),
    })
    expect(replacementPasswordLogin.status).toBe(200)
  })

  function createOutstandingPasswordResetToken(userId: string, token: string) {
    return prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 30 * 60 * 1_000),
      },
    })
  }

  async function expectPasswordResetRejected(token: string) {
    const response = await app.request('/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: 'late-reset-password' }),
    })
    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('AUTH_PASSWORD_RESET_INVALID')
  }

  async function register(email: string, displayName?: string) {
    const response = await app.request('/api/auth/token/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'password123',
        displayName,
      }),
    })
    expect(response.status).toBe(201)
    return response.json()
  }
})

function authenticatedHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
  }
}

function authenticatedJsonHeaders(accessToken: string) {
  return {
    ...authenticatedHeaders(accessToken),
    'Content-Type': 'application/json',
  }
}
