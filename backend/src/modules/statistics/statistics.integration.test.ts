import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../../app'
import { createPrisma } from '../../db'
import { loadEnv } from '../../env'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('statistics API integration', () => {
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
    await prisma.taskSubtask.deleteMany()
    await prisma.task.deleteMany()
    await prisma.userSettings.deleteMany()
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

  test('counts finished work, and only finished work, as time spent', async () => {
    const owner = await register('stats-time@example.com')
    const done = await createTask(owner, '2026-09-22', 'Сделано', 60)
    await request(owner, 'PATCH', `/api/day/tasks/${done}`, { isCompleted: true })
    await createTask(owner, '2026-09-22', 'Не сделано', 120)

    const stats = await read(owner, 'week', '2026-09-22')

    expect(stats.totals.done).toBe(1)
    expect(stats.totals.planned).toBe(1)
    // The 120 planned minutes never happened, so they are not effort.
    expect(stats.totals.doneMinutes).toBe(60)
    expect(stats.totals.activeDays).toBe(1)
  })

  test('gives a point for every day in the window, including empty ones', async () => {
    const owner = await register('stats-daily@example.com')

    const stats = await read(owner, 'week', '2026-09-22')

    expect(stats.daily).toHaveLength(7)
    expect(stats.daily[0]?.date).toBe('2026-09-16')
    expect(stats.daily.at(-1)?.date).toBe('2026-09-22')
    expect(stats.daily.every((point) => point.done === 0)).toBe(true)
  })

  test('attributes time to the goal a task advances', async () => {
    const owner = await register('stats-goals@example.com')
    const stepId = await createStep(owner)
    const created = await request(owner, 'POST', '/api/day/tasks', {
      scheduledOn: '2026-09-22',
      title: 'Шаг цели',
      durationMinutes: 90,
      stepId,
    })
    const taskId = (await created.json()).task.id
    await request(owner, 'PATCH', `/api/day/tasks/${taskId}`, { isCompleted: true })

    const stats = await read(owner, 'week', '2026-09-22')

    expect(stats.goals).toHaveLength(1)
    expect(stats.goals[0]).toMatchObject({ title: 'Цель', minutes: 90, completedSteps: 1 })
  })

  test('a habit streak is the whole run, not the part inside the window', async () => {
    const owner = await register('stats-habits@example.com')
    const habit = await request(owner, 'POST', '/api/habits?today=2026-09-22', {
      title: 'Зарядка',
      startedOn: '2026-09-10',
    })
    const habitId = (await habit.json()).habit.id
    for (let day = 10; day <= 22; day += 1) {
      await request(owner, 'POST', `/api/habits/${habitId}/marks?today=2026-09-22`, {
        markedOn: `2026-09-${String(day).padStart(2, '0')}`,
        isDone: true,
      })
    }

    const stats = await read(owner, 'week', '2026-09-22')

    expect(stats.habits[0]?.currentStreak).toBe(13)
    // Only seven of those days fall inside the week being shown.
    expect(stats.habits[0]?.markedDays).toBe(7)
  })

  test('another account is counted separately', async () => {
    const owner = await register('stats-owner@example.com')
    const stranger = await register('stats-stranger@example.com')
    const taskId = await createTask(owner, '2026-09-22', 'Личное', 30)
    await request(owner, 'PATCH', `/api/day/tasks/${taskId}`, { isCompleted: true })

    const strangerStats = await read(stranger, 'week', '2026-09-22')

    expect(strangerStats.totals.done).toBe(0)
  })

  test('statistics require a session and a real date', async () => {
    const owner = await register('stats-auth@example.com')

    expect((await app.request('/api/statistics?period=week&today=2026-09-22')).status).toBe(401)
    expect(
      (await request(owner, 'GET', '/api/statistics?period=week&today=22-09-2026')).status,
    ).toBe(400)
  })

  async function read(accessToken: string, period: string, today: string) {
    const response = await request(
      accessToken,
      'GET',
      `/api/statistics?period=${period}&today=${today}`,
    )
    expect(response.status).toBe(200)
    return (await response.json()) as {
      totals: {
        planned: number
        done: number
        burned: number
        doneMinutes: number
        activeDays: number
      }
      daily: Array<{ date: string; done: number }>
      goals: Array<{ title: string; minutes: number; completedSteps: number }>
      habits: Array<{ currentStreak: number; markedDays: number }>
    }
  }

  async function createStep(accessToken: string) {
    await request(accessToken, 'PUT', '/api/goals/life-goal', { title: 'Дело жизни' })
    const goal = await (
      await request(accessToken, 'POST', '/api/goals/goals', {
        title: 'Цель',
        deadline: '2027-01-01T00:00:00.000Z',
        measureUnit: 'шагов',
        targetValue: 10,
      })
    ).json()
    const staged = await (
      await request(accessToken, 'POST', `/api/goals/goals/${goal.goal.id}/stages`, {
        title: 'Этап',
      })
    ).json()
    const withStep = await (
      await request(accessToken, 'POST', `/api/goals/stages/${staged.goal.stages[0].id}/steps`, {
        title: 'Шаг',
      })
    ).json()
    return withStep.goal.stages[0].steps[0].id as string
  }

  async function createTask(
    accessToken: string,
    scheduledOn: string,
    title: string,
    durationMinutes: number,
  ) {
    const response = await request(accessToken, 'POST', '/api/day/tasks', {
      scheduledOn,
      title,
      durationMinutes,
    })
    expect(response.status).toBe(201)
    return (await response.json()).task.id as string
  }

  function request(
    accessToken: string,
    method: 'GET' | 'POST' | 'PATCH' | 'PUT',
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
