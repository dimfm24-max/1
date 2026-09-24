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

  test('deleting a goal moves it to the trash with its stages and steps', async () => {
    const owner = await register('cascade@example.com')
    await upsertLifeGoal(owner, 'Дело жизни')
    const goal = await (await request(owner, 'POST', '/api/goals/goals', validGoal())).json()
    const staged = await (
      await request(owner, 'POST', `/api/goals/goals/${goal.goal.id}/stages`, { title: 'Этап' })
    ).json()
    await addSteps(owner, staged.goal.stages[0].id, ['Шаг'])

    const afterDelete = await request(owner, 'DELETE', `/api/goals/goals/${goal.goal.id}`)
    expect(afterDelete.status).toBe(200)
    expect(((await afterDelete.json()) as { goals: unknown[] }).goals).toEqual([])

    // Nothing is lost yet: the rows wait in the trash.
    expect(await prisma.goalStep.count()).toBe(1)
    expect(await prisma.goalStage.count()).toBe(1)
    const tree = await (await request(owner, 'GET', '/api/goals')).json()
    expect(tree.goals).toEqual([])
    // The life goal outlives the goal that was its primary one.
    expect(tree.lifeGoal).not.toBeNull()
    // A goal in the trash cannot be edited or made the main one.
    expect(
      (await request(owner, 'PATCH', `/api/goals/goals/${goal.goal.id}`, { title: 'x' })).status,
    ).toBe(404)
  })

  test('a goal counted from a start moves both ways and keeps its history', async () => {
    const owner = await register('weight@example.com')
    await upsertLifeGoal(owner, 'Здоровье')
    const created = await request(
      owner,
      'POST',
      '/api/goals/goals',
      validGoal({
        title: 'Вес 60 килограммов',
        measureUnit: 'килограммов',
        targetValue: 60,
        initialValue: 80,
        progressMode: 'manual',
      }),
    )
    expect(created.status).toBe(201)
    const goal = (await created.json()).goal
    expect(goal.initialValue).toBe(80)
    expect(goal.currentValue).toBe(80)
    expect(goal.progressRatio).toBe(0)

    const record = async (value: number) =>
      (
        await (
          await request(owner, 'POST', `/api/goals/goals/${goal.id}/progress`, {
            currentValue: value,
          })
        ).json()
      ).goal
    expect((await record(70)).progressRatio).toBe(0.5)
    expect((await record(60)).progressRatio).toBe(1)
    expect((await record(85)).progressRatio).toBe(0)

    const history = await (
      await request(owner, 'GET', `/api/goals/goals/${goal.id}/progress`)
    ).json()
    expect(history.entries.map((entry: { value: number }) => entry.value)).toEqual([80, 70, 60, 85])
    expect(history.entries.map((entry: { reason: string }) => entry.reason)).toEqual([
      'created',
      'manual',
      'manual',
      'manual',
    ])

    // The target has to differ from the start, on create and on edit.
    const same = await request(
      owner,
      'POST',
      '/api/goals/goals',
      validGoal({ targetValue: 50, initialValue: 50, progressMode: 'manual' }),
    )
    expect(same.status).toBe(400)
    const sameEdit = await request(owner, 'PATCH', `/api/goals/goals/${goal.id}`, {
      targetValue: 80,
    })
    expect(sameEdit.status).toBe(400)
  })

  test('a goal is created with its stages and steps at once, and a retry makes no second one', async () => {
    const owner = await register('wizard-goal@example.com')
    await upsertLifeGoal(owner, 'Дело жизни')
    const body = validGoal({
      creationKey: '019c0000-0000-7000-8000-00000000abcd',
      stages: [
        { title: 'Подготовка', steps: [{ title: 'Купить кроссовки' }, { title: 'Первая пробежка' }] },
        { title: 'Тренировки', description: 'Три раза в неделю', steps: [] },
      ],
    })

    const [first, retry] = await Promise.all([
      request(owner, 'POST', '/api/goals/goals', body),
      request(owner, 'POST', '/api/goals/goals', body),
    ])
    expect([first.status, retry.status].every((status) => status === 201)).toBe(true)
    const goal = (await first.json()).goal
    expect((await retry.json()).goal.id).toBe(goal.id)

    // Automatic by default: a completed step moves the goal (owner's decision).
    expect(goal.progressMode).toBe('automatic')
    expect(goal.deadlineWarningDays).toBe(3)
    expect(goal.stages.map((stage: { title: string }) => stage.title)).toEqual([
      'Подготовка',
      'Тренировки',
    ])
    expect(goal.stages[1].description).toBe('Три раза в неделю')
    expect(goal.stages[0].steps).toHaveLength(2)
    expect(await prisma.goal.count()).toBe(1)

    const stepId = goal.stages[0].steps[0].id
    const ticked = await (
      await request(owner, 'PATCH', `/api/goals/steps/${stepId}`, { isCompleted: true })
    ).json()
    expect(ticked.goal.progressRatio).toBe(0.5)
  })

  test('a deadline cannot be set in the past, but an old one does not block other edits', async () => {
    const owner = await register('deadline@example.com')
    await upsertLifeGoal(owner, 'Дело жизни')

    const past = await request(
      owner,
      'POST',
      '/api/goals/goals',
      validGoal({ deadline: '2020-01-01' }),
    )
    expect(past.status).toBe(400)
    expect((await past.json()).error.code).toBe('GOAL_DEADLINE_IN_PAST')

    const goal = (await (await request(owner, 'POST', '/api/goals/goals', validGoal())).json()).goal
    const movedBack = await request(owner, 'PATCH', `/api/goals/goals/${goal.id}`, {
      deadline: '2020-01-01',
    })
    expect(movedBack.status).toBe(400)

    // An overdue goal renamed with its old date sent along is fine.
    await prisma.goal.update({
      where: { id: goal.id },
      data: { deadline: new Date('2020-01-01T00:00:00.000Z') },
    })
    const renamed = await request(owner, 'PATCH', `/api/goals/goals/${goal.id}`, {
      title: 'Новое название',
      deadline: '2020-01-01',
      deadlineWarningDays: 7,
    })
    expect(renamed.status).toBe(200)
    expect((await renamed.json()).goal.deadlineWarningDays).toBe(7)

    await request(owner, 'POST', `/api/goals/goals/${goal.id}/close`, {
      status: 'abandoned',
      outcomeNote: 'Не успел',
    })
    const reopenedInPast = await request(owner, 'POST', `/api/goals/goals/${goal.id}/reopen`, {
      deadline: '2020-02-01',
    })
    expect(reopenedInPast.status).toBe(400)
  })

  test('closing needs an outcome and takes the main mark away', async () => {
    const owner = await register('outcome@example.com')
    await upsertLifeGoal(owner, 'Дело жизни')
    const goal = (await (await request(owner, 'POST', '/api/goals/goals', validGoal())).json()).goal
    expect(goal.isPrimary).toBe(true)

    const silent = await request(owner, 'POST', `/api/goals/goals/${goal.id}/close`, {
      status: 'completed',
    })
    expect(silent.status).toBe(400)
    const blank = await request(owner, 'POST', `/api/goals/goals/${goal.id}/close`, {
      status: 'completed',
      outcomeNote: '   ',
    })
    expect(blank.status).toBe(400)

    const closed = await (
      await request(owner, 'POST', `/api/goals/goals/${goal.id}/close`, {
        status: 'completed',
        outcomeNote: 'Пробежал',
      })
    ).json()
    expect(closed.goal.isPrimary).toBe(false)
    const lifeGoal = await prisma.lifeGoal.findFirstOrThrow()
    expect(lifeGoal.primaryGoalId).toBeNull()

    const refused = await request(owner, 'POST', `/api/goals/goals/${goal.id}/primary`)
    expect(refused.status).toBe(409)
    expect((await refused.json()).error.code).toBe('GOAL_CLOSED')
  })

  test('stages and steps take a description and a new order', async () => {
    const owner = await register('order@example.com')
    await upsertLifeGoal(owner, 'Дело жизни')
    const goal = (
      await (
        await request(
          owner,
          'POST',
          '/api/goals/goals',
          validGoal({
            stages: [
              { title: 'А', steps: [{ title: '1' }, { title: '2' }, { title: '3' }] },
              { title: 'Б', steps: [] },
            ],
          }),
        )
      ).json()
    ).goal
    const [stageA, stageB] = goal.stages
    const stepIds = stageA.steps.map((step: { id: string }) => step.id)

    const described = await (
      await request(owner, 'PATCH', `/api/goals/stages/${stageA.id}`, {
        description: 'Подробности этапа',
      })
    ).json()
    expect(described.goal.stages[0].description).toBe('Подробности этапа')
    expect(described.goal.stages[0].title).toBe('А')

    const stepDescribed = await (
      await request(owner, 'PATCH', `/api/goals/steps/${stepIds[0]}`, {
        description: 'Как сделать шаг',
        estimatedMinutes: 45,
      })
    ).json()
    expect(stepDescribed.goal.stages[0].steps[0]).toMatchObject({
      description: 'Как сделать шаг',
      estimatedMinutes: 45,
    })

    const stagesSwapped = await (
      await request(owner, 'PUT', `/api/goals/goals/${goal.id}/stage-order`, {
        ids: [stageB.id, stageA.id],
      })
    ).json()
    expect(stagesSwapped.goal.stages.map((stage: { title: string }) => stage.title)).toEqual([
      'Б',
      'А',
    ])

    const reversed = [...stepIds].reverse()
    const stepsReversed = await (
      await request(owner, 'PUT', `/api/goals/stages/${stageA.id}/step-order`, { ids: reversed })
    ).json()
    expect(
      stepsReversed.goal.stages[1].steps.map((step: { title: string }) => step.title),
    ).toEqual(['3', '2', '1'])

    // An order that leaves a row out is refused.
    const partial = await request(owner, 'PUT', `/api/goals/stages/${stageA.id}/step-order`, {
      ids: reversed.slice(1),
    })
    expect(partial.status).toBe(400)
  })

  test('trashing a step recounts an automatic goal and writes the change to history', async () => {
    const owner = await register('trash-step@example.com')
    await upsertLifeGoal(owner, 'Дело жизни')
    const goal = (
      await (
        await request(
          owner,
          'POST',
          '/api/goals/goals',
          validGoal({ stages: [{ title: 'Этап', steps: [{ title: '1' }, { title: '2' }] }] }),
        )
      ).json()
    ).goal
    const [first, second] = goal.stages[0].steps
    await request(owner, 'PATCH', `/api/goals/steps/${first.id}`, { isCompleted: true })

    const trashed = await (await request(owner, 'DELETE', `/api/goals/steps/${second.id}`)).json()
    expect(trashed.goal.stages[0].steps).toHaveLength(1)
    expect(trashed.goal.progressRatio).toBe(1)

    const history = await (
      await request(owner, 'GET', `/api/goals/goals/${goal.id}/progress`)
    ).json()
    expect(history.entries.map((entry: { ratio: number }) => entry.ratio)).toEqual([0, 0.5, 1])
  })

  test('deleting the life goal either trashes the goals or leaves them for the next one', async () => {
    const owner = await register('life-goal@example.com')
    await upsertLifeGoal(owner, 'Первое дело')
    const kept = (await (await request(owner, 'POST', '/api/goals/goals', validGoal())).json()).goal

    const detached = await (
      await request(owner, 'DELETE', '/api/goals/life-goal', { goals: 'detach' })
    ).json()
    expect(detached.lifeGoal).toBeNull()
    expect(detached.goals).toHaveLength(1)
    // The main goal is still the main one, and its steps still work.
    expect(detached.goals[0].isPrimary).toBe(true)

    // No new goal without a life goal.
    const refused = await request(owner, 'POST', '/api/goals/goals', validGoal())
    expect(refused.status).toBe(409)
    expect((await refused.json()).error.code).toBe('LIFE_GOAL_REQUIRED')

    // A new life goal takes the detached goals back by itself.
    await upsertLifeGoal(owner, 'Второе дело')
    const tree = await (await request(owner, 'GET', '/api/goals')).json()
    expect(tree.lifeGoal.title).toBe('Второе дело')
    expect(tree.goals.map((goal: { id: string }) => goal.id)).toEqual([kept.id])

    const trashed = await (
      await request(owner, 'DELETE', '/api/goals/life-goal', { goals: 'trash' })
    ).json()
    expect(trashed).toEqual({ lifeGoal: null, goals: [] })
    expect(await prisma.goal.count({ where: { deletedAt: { not: null } } })).toBe(1)

    const again = await request(owner, 'DELETE', '/api/goals/life-goal', { goals: 'trash' })
    expect(again.status).toBe(404)
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
