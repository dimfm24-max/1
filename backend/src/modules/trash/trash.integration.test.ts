import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../../app'
import { createPrisma } from '../../db'
import { loadEnv } from '../../env'
import { purgeExpiredTrashItems } from '.'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

type TrashItem = { kind: string; id: string; title: string; parentTitle: string | null }

maybeDescribe('trash API integration', () => {
  const env = loadEnv({
    DATABASE_URL: databaseUrl!,
    ACCESS_TOKEN_TTL_SECONDS: '60',
    CORS_ORIGINS: 'http://localhost:5173',
    JWT_SECRET: '12345678901234567890123456789012',
  })
  const prisma = createPrisma(databaseUrl!)
  const app = createApp({ env, prisma })

  beforeEach(async () => {
    await prisma.task.deleteMany()
    await prisma.note.deleteMany()
    await prisma.habit.deleteMany()
    await prisma.shareLink.deleteMany()
    await prisma.lifeGoal.updateMany({ data: { primaryGoalId: null } })
    await prisma.goal.deleteMany()
    await prisma.lifeGoal.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('each of the six kinds leaves every screen, waits in the trash and comes back', async () => {
    const owner = await register('trash-all@example.com')
    const tree = await createTree(owner)
    const goalId = tree.goal.id
    const stage = tree.goal.stages[0]
    const step = stage.steps[0]
    const task = await json(
      await request(owner, 'POST', '/api/day/tasks', {
        scheduledOn: '2026-09-22',
        title: 'Пробежка',
        stepId: step.id,
      }),
    )
    const note = await json(await request(owner, 'POST', '/api/notes', { body: 'Мысль', goalId }))
    const habit = await json(
      await request(owner, 'POST', '/api/habits?today=2026-09-22', {
        title: 'Зарядка',
        schedule: 'daily',
        startedOn: '2026-09-01',
      }),
    )

    // The task and the note go first, then the step, then the whole goal.
    expect((await request(owner, 'DELETE', `/api/day/tasks/${task.task.id}`)).status).toBe(200)
    expect((await request(owner, 'DELETE', `/api/notes/${note.note.id}`)).status).toBe(200)
    expect(
      (await request(owner, 'DELETE', `/api/habits/${habit.habit.id}?today=2026-09-22`)).status,
    ).toBe(200)
    expect((await request(owner, 'DELETE', `/api/goals/steps/${step.id}`)).status).toBe(200)
    expect((await request(owner, 'DELETE', `/api/goals/goals/${goalId}`)).status).toBe(200)

    // Nothing is left on any screen.
    const day = await json(await request(owner, 'GET', '/api/day/2026-09-22'))
    expect(day.tasks).toEqual([])
    expect((await json(await request(owner, 'GET', '/api/notes'))).notes).toEqual([])
    expect(
      (await json(await request(owner, 'GET', '/api/habits?today=2026-09-22'))).habits,
    ).toEqual([])
    expect((await json(await request(owner, 'GET', '/api/goals'))).goals).toEqual([])
    const statistics = await json(
      await request(owner, 'GET', '/api/statistics?period=week&today=2026-09-22'),
    )
    expect(statistics.totals.planned).toBe(0)

    // The trash lists all five, most recent first.
    const listed = (await json(await request(owner, 'GET', '/api/trash'))).items as TrashItem[]
    expect(listed.map((item) => item.kind)).toEqual(['goal', 'step', 'habit', 'note', 'task'])
    expect(listed.find((item) => item.kind === 'step')?.parentTitle).toBe('Пробежать марафон')

    // Restoring the step brings the goal back with it, and says so.
    const restored = await json(
      await request(owner, 'POST', `/api/trash/step/${step.id}/restore`),
    )
    expect(restored.restored.map((item: TrashItem) => item.kind)).toEqual(['goal', 'step'])
    const back = await json(await request(owner, 'GET', '/api/goals'))
    expect(back.goals).toHaveLength(1)
    expect(back.goals[0].stages[0].steps.map((each: { id: string }) => each.id)).toContain(step.id)

    // The task still points at its step.
    await request(owner, 'POST', `/api/trash/task/${task.task.id}/restore`)
    const dayBack = await json(await request(owner, 'GET', '/api/day/2026-09-22'))
    expect(dayBack.tasks[0].stepId).toBe(step.id)

    await request(owner, 'POST', `/api/trash/note/${note.note.id}/restore`)
    await request(owner, 'POST', `/api/trash/habit/${habit.habit.id}/restore`)
    expect((await json(await request(owner, 'GET', '/api/notes'))).notes).toHaveLength(1)
    expect(
      (await json(await request(owner, 'GET', '/api/habits?today=2026-09-22'))).habits,
    ).toHaveLength(1)
    expect((await json(await request(owner, 'GET', '/api/trash'))).items).toEqual([])

    // Restoring what is not in the trash is a 404.
    expect((await request(owner, 'POST', `/api/trash/note/${note.note.id}/restore`)).status).toBe(
      404,
    )
  })

  test('the public page shows nothing from the trash', async () => {
    const owner = await register('trash-public@example.com')
    const tree = await createTree(owner)
    const link = await json(await request(owner, 'POST', '/api/share/enable'))
    const token = link.share.token as string

    const before = await (await app.request(`/api/share/public/${token}?today=2026-09-22`)).json()
    expect(before.goals).toHaveLength(1)

    await request(owner, 'DELETE', `/api/goals/goals/${tree.goal.id}`)
    const after = await (await app.request(`/api/share/public/${token}?today=2026-09-22`)).json()
    expect(after.goals).toEqual([])
  })

  test('"delete for good" is immediate, and only the owner can do it', async () => {
    const owner = await register('trash-purge@example.com')
    const stranger = await register('trash-stranger@example.com')
    const note = await json(await request(owner, 'POST', '/api/notes', { body: 'Удалить' }))
    await request(owner, 'DELETE', `/api/notes/${note.note.id}`)

    expect((await request(stranger, 'DELETE', `/api/trash/note/${note.note.id}`)).status).toBe(404)
    expect((await request(stranger, 'GET', '/api/trash')).status).toBe(200)
    expect((await json(await request(stranger, 'GET', '/api/trash'))).items).toEqual([])

    expect((await request(owner, 'DELETE', `/api/trash/note/${note.note.id}`)).status).toBe(200)
    expect(await prisma.note.count()).toBe(0)
  })

  test('after 30 days the sweep removes what is in the trash and nothing else', async () => {
    const owner = await register('trash-sweep@example.com')
    const tree = await createTree(owner)
    const kept = await json(await request(owner, 'POST', '/api/notes', { body: 'Оставить' }))
    const old = await json(await request(owner, 'POST', '/api/notes', { body: 'Старая' }))
    await request(owner, 'DELETE', `/api/notes/${old.note.id}`)
    await request(owner, 'DELETE', `/api/goals/goals/${tree.goal.id}`)

    const deletedAt = new Date('2026-08-01T12:00:00.000Z')
    await prisma.note.updateMany({ where: { id: old.note.id }, data: { deletedAt } })
    await prisma.goal.updateMany({ where: { id: tree.goal.id }, data: { deletedAt } })

    // A day short of thirty: nothing goes.
    expect(await purgeExpiredTrashItems(prisma, new Date('2026-08-30T12:00:00.000Z'))).toBe(0)
    // Past thirty days: both go, with the goal's stages and steps.
    expect(await purgeExpiredTrashItems(prisma, new Date('2026-09-01T12:00:00.000Z'))).toBe(2)
    expect(await prisma.goal.count()).toBe(0)
    expect(await prisma.goalStep.count()).toBe(0)
    expect((await prisma.note.findMany()).map((note) => note.id)).toEqual([kept.note.id])
  })

  async function createTree(accessToken: string) {
    await request(accessToken, 'PUT', '/api/goals/life-goal', { title: 'Здоровье' })
    const response = await request(accessToken, 'POST', '/api/goals/goals', {
      title: 'Пробежать марафон',
      deadline: '2027-05-01',
      measureUnit: 'километров',
      targetValue: 42,
      stages: [{ title: 'Подготовка', steps: [{ title: 'Купить кроссовки' }, { title: 'Бег' }] }],
    })
    expect(response.status).toBe(201)
    return (await response.json()) as {
      goal: { id: string; stages: Array<{ id: string; steps: Array<{ id: string }> }> }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function json(response: Response): Promise<any> {
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
