import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../../app'
import { createPrisma } from '../../db'
import { loadEnv } from '../../env'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('sharing API integration', () => {
  const env = loadEnv({
    DATABASE_URL: databaseUrl!,
    ACCESS_TOKEN_TTL_SECONDS: '60',
    CORS_ORIGINS: 'http://localhost:5173',
    JWT_SECRET: '12345678901234567890123456789012',
  })
  const prisma = createPrisma(databaseUrl!)
  const app = createApp({ env, prisma })

  beforeEach(async () => {
    await prisma.shareComment.deleteMany()
    await prisma.shareLink.deleteMany()
    await prisma.habitMark.deleteMany()
    await prisma.habit.deleteMany()
    await prisma.task.deleteMany()
    await prisma.goalStep.deleteMany()
    await prisma.goalStage.deleteMany()
    await prisma.lifeGoal.updateMany({ data: { primaryGoalId: null } })
    await prisma.goal.deleteMany()
    await prisma.lifeGoal.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('sharing is off until it is turned on', async () => {
    const owner = await register('share-off@example.com')

    const settings = await json(await request(owner, 'GET', '/api/share/settings'))

    expect(settings.share.token).toBeNull()
  })

  test('the page opens without a session and shows only the chosen sections', async () => {
    const owner = await register('share-public@example.com')
    await createGoal(owner, 'Пробежать марафон')
    const token = await enable(owner)

    const page = await publicPage(token)

    expect(page.goals?.map((goal) => goal.title)).toEqual(['Пробежать марафон'])
    // Habits and statistics stay hidden until the owner opts in.
    expect(page.habits).toBeNull()
    expect(page.statistics).toBeNull()
  })

  test('the page never carries the email or the account id', async () => {
    const owner = await register('share-identity@example.com')
    const token = await enable(owner)

    const response = await app.request(`/api/share/public/${token}?today=2026-09-22`)
    const body = await response.text()

    expect(body).not.toContain('share-identity@example.com')
  })

  test('a goal marked private stays off the page while the section is shown', async () => {
    const owner = await register('share-private@example.com')
    const publicGoal = await createGoal(owner, 'Открытая цель')
    const secret = await createGoal(owner, 'Личная цель')
    await prisma.goal.update({ where: { id: secret }, data: { isPrivate: true } })
    const token = await enable(owner)

    const page = await publicPage(token)

    expect(page.goals?.map((goal) => goal.id)).toEqual([publicGoal])
  })

  test('anyone with the link may comment, and the owner may delete any comment', async () => {
    const owner = await register('share-comments@example.com')
    const token = await enable(owner)

    const posted = await json(
      await app.request(`/api/share/public/${token}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorName: '  Аня  ', body: 'Держись!' }),
      }),
    )
    expect(posted.comments).toHaveLength(1)
    expect(posted.comments[0]?.authorName).toBe('Аня')

    const afterDelete = await json(
      await request(owner, 'DELETE', `/api/share/comments/${posted.comments[0]!.id}`),
    )
    expect(afterDelete.comments).toEqual([])
  })

  test('rotating the address kills the old one at once', async () => {
    const owner = await register('share-rotate@example.com')
    const first = await enable(owner)

    const rotated = await json(await request(owner, 'POST', '/api/share/rotate'))
    const second = rotated.share.token!

    expect(second).not.toBe(first)
    expect((await app.request(`/api/share/public/${first}?today=2026-09-22`)).status).toBe(404)
    expect((await app.request(`/api/share/public/${second}?today=2026-09-22`)).status).toBe(200)
  })

  test('disabling removes the page and its comments', async () => {
    const owner = await register('share-disable@example.com')
    const token = await enable(owner)
    await app.request(`/api/share/public/${token}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorName: 'Аня', body: 'Привет' }),
    })

    await request(owner, 'POST', '/api/share/disable')

    expect((await app.request(`/api/share/public/${token}?today=2026-09-22`)).status).toBe(404)
    expect(await prisma.shareComment.count()).toBe(0)
  })

  test('one person cannot delete comments left on another page', async () => {
    const owner = await register('share-owner@example.com')
    const stranger = await register('share-stranger@example.com')
    const token = await enable(owner)
    const posted = await json(
      await app.request(`/api/share/public/${token}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorName: 'Аня', body: 'Привет' }),
      }),
    )

    const refused = await request(
      stranger,
      'DELETE',
      `/api/share/comments/${posted.comments[0]!.id}`,
    )

    expect(refused.status).toBe(404)
    expect(await prisma.shareComment.count()).toBe(1)
  })

  test('an unknown address is not found, and an empty comment is refused', async () => {
    expect(
      (await app.request(`/api/share/public/${'a'.repeat(32)}?today=2026-09-22`)).status,
    ).toBe(404)

    const owner = await register('share-validation@example.com')
    const token = await enable(owner)
    const refused = await app.request(`/api/share/public/${token}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorName: 'Аня', body: '   ' }),
    })
    expect(refused.status).toBe(400)
  })

  async function enable(accessToken: string) {
    const response = await json(await request(accessToken, 'POST', '/api/share/enable'))
    return response.share.token!
  }

  async function publicPage(token: string) {
    const response = await app.request(`/api/share/public/${token}?today=2026-09-22`)
    expect(response.status).toBe(200)
    return (await response.json()) as {
      goals: Array<{ id: string; title: string }> | null
      habits: unknown[] | null
      statistics: unknown | null
    }
  }

  async function createGoal(accessToken: string, title: string) {
    await request(accessToken, 'PUT', '/api/goals/life-goal', { title: 'Дело жизни' })
    const goal = await (
      await request(accessToken, 'POST', '/api/goals/goals', {
        title,
        deadline: '2027-01-01T00:00:00.000Z',
        measureUnit: 'километров',
        targetValue: 42,
      })
    ).json()
    return goal.goal.id as string
  }

  async function json(response: Response): Promise<{
    share: { token: string | null }
    comments: Array<{ id: string; authorName: string }>
  }> {
    return response.json()
  }

  function request(
    accessToken: string,
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ) {
    return app.request(path, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  }

  async function register(email: string) {
    const response = await app.request('/api/auth/token/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    })
    expect(response.status).toBe(201)
    return (await response.json()).accessToken as string
  }
})
