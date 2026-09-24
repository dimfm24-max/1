import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../../app'
import { createPrisma } from '../../db'
import { loadEnv } from '../../env'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

type TaskView = {
  id: string
  scheduledOn: string
  outcome: string
  movedFrom: string | null
  startMinute: number | null
  durationMinutes: number
  completedAt: string | null
  stepId: string | null
  categoryId: string | null
  subtasks: Array<{ id: string; completedAt: string | null }>
}

maybeDescribe('day API integration', () => {
  const env = loadEnv({
    DATABASE_URL: databaseUrl!,
    ACCESS_TOKEN_TTL_SECONDS: '60',
    CORS_ORIGINS: 'http://localhost:5173',
    JWT_SECRET: '12345678901234567890123456789012',
  })
  const prisma = createPrisma(databaseUrl!)
  const app = createApp({ env, prisma })

  beforeEach(async () => {
    await prisma.taskSubtask.deleteMany()
    await prisma.task.deleteMany()
    await prisma.dayTemplateItem.deleteMany()
    await prisma.dayTemplate.deleteMany()
    await prisma.taskCategory.deleteMany()
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

  test('a new account gets working settings without ever creating them', async () => {
    const owner = await register('settings@example.com')

    const context = await json(await request(owner, 'GET', '/api/day/context'))

    expect(context.settings).toEqual({
      dayStartMinute: 0,
      defaultTaskMinutes: 30,
      tone: 'friendly',
      birthDate: null,
      lifeExpectancy: 80,
      timeZone: null,
    })
  })

  test('a task takes the default duration until the person changes the default', async () => {
    const owner = await register('duration@example.com')

    const first = await json(
      await request(owner, 'POST', '/api/day/tasks', {
        scheduledOn: '2026-09-22',
        title: 'Пробежка',
      }),
    )
    expect(first.task.durationMinutes).toBe(30)

    await request(owner, 'PATCH', '/api/day/settings', { defaultTaskMinutes: 45 })
    const second = await json(
      await request(owner, 'POST', '/api/day/tasks', {
        scheduledOn: '2026-09-22',
        title: 'Чтение',
      }),
    )
    expect(second.task.durationMinutes).toBe(45)
  })

  test('the day is addressed by date, whatever the hour', async () => {
    const owner = await register('dates@example.com')
    await request(owner, 'POST', '/api/day/tasks', {
      scheduledOn: '2026-09-22',
      title: 'Сегодня',
      startMinute: 23 * 60 + 50,
    })

    const today = await json(await request(owner, 'GET', '/api/day/2026-09-22'))
    const tomorrow = await json(await request(owner, 'GET', '/api/day/2026-09-23'))

    expect(today.tasks).toHaveLength(1)
    expect(today.tasks[0].scheduledOn).toBe('2026-09-22')
    expect(tomorrow.tasks).toEqual([])
  })

  test('an unfinished task either moves, remembering where it came from, or is let go', async () => {
    const owner = await register('resolve@example.com')
    const moved = await createTask(owner, { scheduledOn: '2026-09-22', title: 'Перенести' })
    const burned = await createTask(owner, { scheduledOn: '2026-09-22', title: 'Отпустить' })

    const afterMove = await json(
      await request(owner, 'POST', `/api/day/tasks/${moved.id}/resolve`, {
        action: 'move',
        scheduledOn: '2026-09-23',
      }),
    )
    expect(afterMove.task.scheduledOn).toBe('2026-09-23')
    expect(afterMove.task.movedFrom).toBe('2026-09-22')
    expect(afterMove.task.outcome).toBe('planned')

    const afterBurn = await json(
      await request(owner, 'POST', `/api/day/tasks/${burned.id}/resolve`, { action: 'burn' }),
    )
    expect(afterBurn.task.outcome).toBe('burned')

    // A burned task stays in its day's history rather than disappearing from it.
    const day = await json(await request(owner, 'GET', '/api/day/2026-09-22'))
    expect(day.tasks.map((task: TaskView) => task.outcome)).toEqual(['burned'])
  })

  test('a finished task cannot be resolved again', async () => {
    const owner = await register('resolved@example.com')
    const task = await createTask(owner, { scheduledOn: '2026-09-22', title: 'Сделано' })
    await request(owner, 'PATCH', `/api/day/tasks/${task.id}`, { isCompleted: true })

    const refused = await request(owner, 'POST', `/api/day/tasks/${task.id}/resolve`, {
      action: 'burn',
    })

    expect(refused.status).toBe(409)
    expect((await refused.json()).error.code).toBe('TASK_ALREADY_RESOLVED')
  })

  test('completing a task twice keeps the moment it was first done', async () => {
    const owner = await register('completion@example.com')
    const task = await createTask(owner, { scheduledOn: '2026-09-22', title: 'Шаг' })

    const first = await json(
      await request(owner, 'PATCH', `/api/day/tasks/${task.id}`, { isCompleted: true }),
    )
    const completedAt = first.task.completedAt
    expect(completedAt).not.toBeNull()

    const again = await json(
      await request(owner, 'PATCH', `/api/day/tasks/${task.id}`, { isCompleted: true }),
    )
    expect(again.task.completedAt).toBe(completedAt)

    const undone = await json(
      await request(owner, 'PATCH', `/api/day/tasks/${task.id}`, { isCompleted: false }),
    )
    expect(undone.task.completedAt).toBeNull()
    expect(undone.task.outcome).toBe('planned')
  })

  test('a task may point at a step of this person, and never at someone else\'s', async () => {
    const owner = await register('steps@example.com')
    const stranger = await register('stranger-steps@example.com')
    const stepId = await createStep(owner)
    const strangerStepId = await createStep(stranger)

    const linked = await json(
      await request(owner, 'POST', '/api/day/tasks', {
        scheduledOn: '2026-09-22',
        title: 'Шаг цели',
        stepId,
      }),
    )
    expect(linked.task.stepId).toBe(stepId)

    const refused = await request(owner, 'POST', '/api/day/tasks', {
      scheduledOn: '2026-09-22',
      title: 'Чужой шаг',
      stepId: strangerStepId,
    })
    expect(refused.status).toBe(404)
  })

  test('applying a template adds to the day instead of replacing it', async () => {
    const owner = await register('templates@example.com')
    await createTask(owner, { scheduledOn: '2026-09-22', title: 'Уже запланировано' })

    const created = await json(
      await request(owner, 'POST', '/api/day/templates', { title: 'Будний день' }),
    )
    const templateId = created.templates[0].id
    await request(owner, 'POST', `/api/day/templates/${templateId}/items`, {
      title: 'Зарядка',
      startMinute: 420,
      durationMinutes: 20,
    })
    await request(owner, 'POST', `/api/day/templates/${templateId}/items`, { title: 'Работа' })

    const day = await json(
      await request(owner, 'POST', '/api/day/templates/apply', {
        templateId,
        scheduledOn: '2026-09-22',
      }),
    )

    expect(day.tasks).toHaveLength(3)
    expect(day.tasks.map((task: TaskView) => task.durationMinutes)).toContain(20)
  })

  test('deleting a category keeps the work filed under it', async () => {
    const owner = await register('categories@example.com')
    const categories = await json(
      await request(owner, 'POST', '/api/day/categories', {
        title: 'Спорт',
        color: '#22c55e',
      }),
    )
    const categoryId = categories.categories[0].id
    const task = await createTask(owner, {
      scheduledOn: '2026-09-22',
      title: 'Тренировка',
      categoryId,
    })

    await request(owner, 'DELETE', `/api/day/categories/${categoryId}`)

    const day = await json(await request(owner, 'GET', '/api/day/2026-09-22'))
    expect(day.tasks).toHaveLength(1)
    expect(day.tasks[0].id).toBe(task.id)
    expect(day.tasks[0].categoryId).toBeNull()
  })

  test('subtasks are checked off inside their task', async () => {
    const owner = await register('subtasks@example.com')
    const task = await createTask(owner, { scheduledOn: '2026-09-22', title: 'Уборка' })

    const withSubtask = await json(
      await request(owner, 'POST', `/api/day/tasks/${task.id}/subtasks`, { title: 'Кухня' }),
    )
    const subtaskId = withSubtask.task.subtasks[0].id

    const checked = await json(
      await request(owner, 'PATCH', `/api/day/subtasks/${subtaskId}`, { isCompleted: true }),
    )
    expect(checked.task.subtasks[0].completedAt).not.toBeNull()

    const removed = await json(
      await request(owner, 'DELETE', `/api/day/subtasks/${subtaskId}`),
    )
    expect(removed.task.subtasks).toEqual([])
  })

  test('another account cannot see or touch this day', async () => {
    const owner = await register('day-owner@example.com')
    const stranger = await register('day-stranger@example.com')
    const task = await createTask(owner, { scheduledOn: '2026-09-22', title: 'Личное' })

    const strangerDay = await json(await request(stranger, 'GET', '/api/day/2026-09-22'))
    expect(strangerDay.tasks).toEqual([])

    expect(
      (await request(stranger, 'PATCH', `/api/day/tasks/${task.id}`, { title: 'Чужое' })).status,
    ).toBe(404)
    expect((await request(stranger, 'DELETE', `/api/day/tasks/${task.id}`)).status).toBe(404)
    const ownerDelete = await request(owner, 'DELETE', `/api/day/tasks/${task.id}`)
    expect(ownerDelete.status).toBe(200)
    expect((await ownerDelete.json()).tasks).toEqual([])
  })

  test('the day requires a session', async () => {
    expect((await app.request('/api/day/2026-09-22')).status).toBe(401)
    expect((await app.request('/api/day/context')).status).toBe(401)
  })

  test('a malformed date is refused before it reaches the database', async () => {
    const owner = await register('bad-date@example.com')

    expect((await request(owner, 'GET', '/api/day/22-09-2026')).status).toBe(400)
    expect(
      (await request(owner, 'POST', '/api/day/tasks', {
        scheduledOn: 'tomorrow',
        title: 'Задача',
      })).status,
    ).toBe(400)
  })

  async function createStep(accessToken: string) {
    await request(accessToken, 'PUT', '/api/goals/life-goal', { title: 'Дело жизни' })
    const goal = await json(
      await request(accessToken, 'POST', '/api/goals/goals', {
        title: 'Цель',
        deadline: '2027-01-01T00:00:00.000Z',
        measureUnit: 'шагов',
        targetValue: 10,
      }),
    )
    const staged = await json(
      await request(accessToken, 'POST', `/api/goals/goals/${goal.goal.id}/stages`, {
        title: 'Этап',
      }),
    )
    const withStep = await json(
      await request(accessToken, 'POST', `/api/goals/stages/${staged.goal.stages[0].id}/steps`, {
        title: 'Шаг',
      }),
    )
    return withStep.goal.stages[0].steps[0].id as string
  }

  async function createTask(accessToken: string, body: Record<string, unknown>) {
    const response = await request(accessToken, 'POST', '/api/day/tasks', body)
    expect(response.status).toBe(201)
    return (await response.json()).task as TaskView
  }

  // The shapes these tests read. Written as one type rather than per call so a typo in a field
  // name fails here instead of quietly reading undefined.
  async function json(response: Response): Promise<{
    settings: {
      dayStartMinute: number
      defaultTaskMinutes: number
      tone: string
      birthDate: string | null
      lifeExpectancy: number | null
      timeZone?: string | null
    }
    task: TaskView
    tasks: TaskView[]
    templates: Array<{ id: string }>
    categories: Array<{ id: string }>
    goal: { id: string; stages: Array<{ id: string; steps: Array<{ id: string }> }> }
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
