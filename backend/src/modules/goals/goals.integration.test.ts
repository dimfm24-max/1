import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../../app'
import { createPrisma } from '../../db'
import { loadEnv } from '../../env'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('goals API integration', () => {
  const env = loadEnv({
    DATABASE_URL: databaseUrl!,
    ACCESS_TOKEN_TTL_SECONDS: '60',
    CORS_ORIGINS: 'http://localhost:5173',
    JWT_SECRET: '12345678901234567890123456789012',
  })
  const prisma = createPrisma(databaseUrl!)
  const app = createApp({ env, prisma })

  beforeEach(async () => {
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

  test('a goal cannot exist before the life goal it belongs to', async () => {
    const owner = await register('no-life-goal@example.com')

    const refused = await request(owner, 'POST', '/api/goals/goals', validGoal())

    expect(refused.status).toBe(409)
    expect((await refused.json()).error.code).toBe('LIFE_GOAL_REQUIRED')
  })

  test('the first goal becomes the one the day screen shows', async () => {
    const owner = await register('first-goal@example.com')
    await upsertLifeGoal(owner, 'Быть в форме')

    const first = await (await request(owner, 'POST', '/api/goals/goals', validGoal())).json()
    expect(first.goal.isPrimary).toBe(true)

    const second = await (
      await request(owner, 'POST', '/api/goals/goals', validGoal({ title: 'Вторая цель' }))
    ).json()
    expect(second.goal.isPrimary).toBe(false)

    const promoted = await (
      await request(owner, 'POST', `/api/goals/goals/${second.goal.id}/primary`)
    ).json()
    expect(promoted.goal.isPrimary).toBe(true)

    const tree = await (await request(owner, 'GET', '/api/goals')).json()
    expect(tree.goals.filter((goal: { isPrimary: boolean }) => goal.isPrimary)).toHaveLength(1)
  })

  test('an automatic goal counts its completed steps and a manual one does not', async () => {
    const owner = await register('progress@example.com')
    await upsertLifeGoal(owner, 'Дело жизни')
    const automatic = await (
      await request(
        owner,
        'POST',
        '/api/goals/goals',
        validGoal({ progressMode: 'automatic', targetValue: 100 }),
      )
    ).json()
    const stage = await (
      await request(owner, 'POST', `/api/goals/goals/${automatic.goal.id}/stages`, {
        title: 'Подготовка',
      })
    ).json()
    const stageId = stage.goal.stages[0].id

    const withSteps = await addSteps(owner, stageId, ['Шаг 1', 'Шаг 2', 'Шаг 3', 'Шаг 4'])
    expect(withSteps.goal.currentValue).toBe(0)

    const stepId = withSteps.goal.stages[0].steps[0].id
    const afterOne = await (
      await request(owner, 'PATCH', `/api/goals/steps/${stepId}`, { isCompleted: true })
    ).json()
    expect(afterOne.goal.currentValue).toBe(25)

    const refused = await request(owner, 'POST', `/api/goals/goals/${automatic.goal.id}/progress`, {
      currentValue: 90,
    })
    expect(refused.status).toBe(409)
    expect((await refused.json()).error.code).toBe('GOAL_PROGRESS_NOT_MANUAL')
  })

  test('completing a step twice keeps the moment it was first done', async () => {
    const owner = await register('step-moment@example.com')
    await upsertLifeGoal(owner, 'Дело жизни')
    const goal = await (await request(owner, 'POST', '/api/goals/goals', validGoal())).json()
    const staged = await (
      await request(owner, 'POST', `/api/goals/goals/${goal.goal.id}/stages`, { title: 'Этап' })
    ).json()
    const withStep = await addSteps(owner, staged.goal.stages[0].id, ['Единственный шаг'])
    const stepId = withStep.goal.stages[0].steps[0].id

    const first = await (
      await request(owner, 'PATCH', `/api/goals/steps/${stepId}`, { isCompleted: true })
    ).json()
    const completedAt = first.goal.stages[0].steps[0].completedAt
    expect(completedAt).not.toBeNull()

    const again = await (
      await request(owner, 'PATCH', `/api/goals/steps/${stepId}`, { isCompleted: true })
    ).json()
    expect(again.goal.stages[0].steps[0].completedAt).toBe(completedAt)

    const undone = await (
      await request(owner, 'PATCH', `/api/goals/steps/${stepId}`, { isCompleted: false })
    ).json()
    expect(undone.goal.stages[0].steps[0].completedAt).toBeNull()
  })

  test('a closed goal refuses edits until it is reopened, and keeps its outcome note', async () => {
    const owner = await register('closing@example.com')
    await upsertLifeGoal(owner, 'Дело жизни')
    const goal = await (await request(owner, 'POST', '/api/goals/goals', validGoal())).json()

    const closed = await (
      await request(owner, 'POST', `/api/goals/goals/${goal.goal.id}/close`, {
        status: 'completed',
        outcomeNote: 'Дошёл до конца',
      })
    ).json()
    expect(closed.goal.status).toBe('completed')
    expect(closed.goal.completedAt).not.toBeNull()

    const refused = await request(owner, 'PATCH', `/api/goals/goals/${goal.goal.id}`, {
      title: 'Новое название',
    })
    expect(refused.status).toBe(409)
    expect((await refused.json()).error.code).toBe('GOAL_CLOSED')

    const reopened = await (
      await request(owner, 'POST', `/api/goals/goals/${goal.goal.id}/reopen`, {
        deadline: '2028-01-01T00:00:00.000Z',
      })
    ).json()
    expect(reopened.goal.status).toBe('active')
    expect(reopened.goal.completedAt).toBeNull()
    expect(reopened.goal.outcomeNote).toBe('Дошёл до конца')
  })

  test('another account cannot read or touch this tree', async () => {
    const owner = await register('owner@example.com')
    const stranger = await register('stranger@example.com')
    await upsertLifeGoal(owner, 'Дело жизни')
    const goal = await (await request(owner, 'POST', '/api/goals/goals', validGoal())).json()

    expect((await request(stranger, 'GET', '/api/goals')).status).toBe(200)
    const strangerTree = await (await request(stranger, 'GET', '/api/goals')).json()
    expect(strangerTree).toEqual({ lifeGoal: null, goals: [] })

    for (const [method, path, body] of [
      ['PATCH', `/api/goals/goals/${goal.goal.id}`, { title: 'Чужая цель' }],
      ['POST', `/api/goals/goals/${goal.goal.id}/primary`, undefined],
      ['DELETE', `/api/goals/goals/${goal.goal.id}`, undefined],
    ] as const) {
      expect((await request(stranger, method, path, body)).status).toBe(404)
    }

    expect((await request(owner, 'GET', '/api/goals')).status).toBe(200)
  })

  test('deleting a goal takes its stages and steps with it', async () => {
    const owner = await register('cascade@example.com')
    await upsertLifeGoal(owner, 'Дело жизни')
    const goal = await (await request(owner, 'POST', '/api/goals/goals', validGoal())).json()
    const staged = await (
      await request(owner, 'POST', `/api/goals/goals/${goal.goal.id}/stages`, { title: 'Этап' })
    ).json()
    await addSteps(owner, staged.goal.stages[0].id, ['Шаг'])

    expect((await request(owner, 'DELETE', `/api/goals/goals/${goal.goal.id}`)).status).toBe(204)

    expect(await prisma.goalStep.count()).toBe(0)
    expect(await prisma.goalStage.count()).toBe(0)
    const tree = await (await request(owner, 'GET', '/api/goals')).json()
    expect(tree.goals).toEqual([])
    // The life goal outlives the goal that was its primary one.
    expect(tree.lifeGoal).not.toBeNull()
  })

  test('the tree requires a session', async () => {
    expect((await app.request('/api/goals')).status).toBe(401)
  })

  function validGoal(overrides: Record<string, unknown> = {}) {
    return {
      title: 'Пробежать марафон',
      deadline: '2027-05-01T00:00:00.000Z',
      measureUnit: 'километров',
      targetValue: 42,
      ...overrides,
    }
  }

  type StepView = { id: string; completedAt: string | null }
  type GoalView = {
    goal: { currentValue: number; stages: Array<{ id: string; steps: StepView[] }> }
  }

  async function addSteps(accessToken: string, stageId: string, titles: string[]) {
    let last: GoalView | undefined
    for (const title of titles) {
      const response = await request(accessToken, 'POST', `/api/goals/stages/${stageId}/steps`, {
        title,
      })
      expect(response.status).toBe(200)
      last = (await response.json()) as GoalView
    }
    return last!
  }

  async function upsertLifeGoal(accessToken: string, title: string) {
    const response = await request(accessToken, 'PUT', '/api/goals/life-goal', { title })
    expect(response.status).toBe(200)
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
