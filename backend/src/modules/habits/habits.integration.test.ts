import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../../app'
import { createPrisma } from '../../db'
import { loadEnv } from '../../env'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

type HabitView = {
  id: string
  title: string
  marks: string[]
  currentStreak: number
  longestStreak: number
  archivedAt: string | null
}

maybeDescribe('habits API integration', () => {
  const env = loadEnv({
    DATABASE_URL: databaseUrl!,
    ACCESS_TOKEN_TTL_SECONDS: '60',
    CORS_ORIGINS: 'http://localhost:5173',
    JWT_SECRET: '12345678901234567890123456789012',
  })
  const prisma = createPrisma(databaseUrl!)
  let now = new Date()
  const server = createApp({ env, prisma, clock: { now: () => now } })
  // Requests still name the day they stand on as `?today=`. The server now takes the day from
  // its own clock, so the test moves that clock to the named day: noon UTC, the same date in the
  // fallback zone.
  const app = {
    request(path: string, init?: RequestInit) {
      const day = /[?&]today=(\d{4}-\d{2}-\d{2})/.exec(path)?.[1]
      if (day) now = new Date(`${day}T12:00:00.000Z`)
      return server.request(path, init)
    },
  }

  beforeEach(async () => {
    await prisma.habitMark.deleteMany()
    await prisma.habit.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('a kept habit builds a streak, and a missed due day breaks it', async () => {
    const owner = await register('streak@example.com')
    const habit = await createHabit(owner, { title: 'Зарядка', startedOn: '2026-09-01' })

    for (const day of ['2026-09-01', '2026-09-02', '2026-09-03']) {
      await mark(owner, habit.id, day, '2026-09-03')
    }
    const kept = await readHabit(owner, '2026-09-03')
    expect(kept.currentStreak).toBe(3)

    // Two days later with nothing recorded: the run is over, the record survives.
    const broken = await readHabit(owner, '2026-09-05')
    expect(broken.currentStreak).toBe(0)
    expect(broken.longestStreak).toBe(3)
  })

  test('days the habit was never due do not break it', async () => {
    const owner = await register('interval@example.com')
    const habit = await createHabit(owner, {
      title: 'Через день',
      schedule: 'interval',
      intervalDays: 3,
      startedOn: '2026-09-01',
    })

    for (const day of ['2026-09-01', '2026-09-04', '2026-09-07']) {
      await mark(owner, habit.id, day, '2026-09-07')
    }

    expect((await readHabit(owner, '2026-09-07')).currentStreak).toBe(3)
  })

  test('marking the same day twice is the same fact, and unmarking removes it', async () => {
    const owner = await register('idempotent@example.com')
    const habit = await createHabit(owner, { title: 'Чтение', startedOn: '2026-09-01' })

    await mark(owner, habit.id, '2026-09-01', '2026-09-01')
    const twice = await mark(owner, habit.id, '2026-09-01', '2026-09-01')
    expect(twice.marks).toEqual(['2026-09-01'])

    const removed = await mark(owner, habit.id, '2026-09-01', '2026-09-01', false)
    expect(removed.marks).toEqual([])
  })

  test('archiving keeps every mark', async () => {
    const owner = await register('archive@example.com')
    const habit = await createHabit(owner, { title: 'Бег', startedOn: '2026-09-01' })
    await mark(owner, habit.id, '2026-09-01', '2026-09-02')

    const archived = await json(
      await request(owner, 'PATCH', `/api/habits/${habit.id}?today=2026-09-02`, {
        isArchived: true,
      }),
    )

    expect(archived.habit.archivedAt).not.toBeNull()
    expect(archived.habit.marks).toEqual(['2026-09-01'])
  })

  test('a weekday habit refuses to exist without weekdays', async () => {
    const owner = await register('weekdays@example.com')

    const refused = await request(owner, 'POST', '/api/habits?today=2026-09-01', {
      title: 'По будням',
      schedule: 'weekdays',
      startedOn: '2026-09-01',
    })

    expect(refused.status).toBe(400)
  })

  test('another account sees none of these habits', async () => {
    const owner = await register('habits-owner@example.com')
    const stranger = await register('habits-stranger@example.com')
    const habit = await createHabit(owner, { title: 'Личное', startedOn: '2026-09-01' })

    const strangerList = await json(
      await request(stranger, 'GET', '/api/habits?today=2026-09-01'),
    )
    expect(strangerList.habits).toEqual([])

    expect(
      (await request(stranger, 'DELETE', `/api/habits/${habit.id}?today=2026-09-01`)).status,
    ).toBe(404)
  })

  test('habits require a session and a real date', async () => {
    const owner = await register('habits-auth@example.com')

    expect((await app.request('/api/habits?today=2026-09-01')).status).toBe(401)
    expect((await request(owner, 'GET', '/api/habits?today=01-09-2026')).status).toBe(400)
  })

  async function createHabit(accessToken: string, body: Record<string, unknown>) {
    const response = await request(accessToken, 'POST', '/api/habits?today=2026-09-01', body)
    expect(response.status).toBe(201)
    return (await response.json()).habit as HabitView
  }

  async function mark(
    accessToken: string,
    habitId: string,
    markedOn: string,
    today: string,
    isDone = true,
  ) {
    const response = await request(
      accessToken,
      'POST',
      `/api/habits/${habitId}/marks?today=${today}`,
      { markedOn, isDone },
    )
    expect(response.status).toBe(200)
    return (await response.json()).habit as HabitView
  }

  async function readHabit(accessToken: string, today: string) {
    const list = await json(await request(accessToken, 'GET', `/api/habits?today=${today}`))
    return list.habits[0]!
  }

  async function json(response: Response): Promise<{ habits: HabitView[]; habit: HabitView }> {
    return response.json()
  }

  function request(
    accessToken: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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
