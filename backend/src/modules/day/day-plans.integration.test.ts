import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../../app'
import { createPrisma } from '../../db'
import { loadEnv } from '../../env'
import { materializeUpcomingPlans } from '.'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

type Task = {
  id: string
  title: string
  scheduledOn: string
  startMinute: number | null
  durationMinutes: number
  categoryId: string | null
  stepId: string | null
  repeat?: { seriesId: string } | null
}

function shift(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function weekday(date: string) {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay()
}

maybeDescribe('day plans integration: categories, order, steps, repeats, templates', () => {
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
    await prisma.taskSeries.deleteMany()
    await prisma.dayTemplate.deleteMany()
    await prisma.taskCategory.deleteMany()
    await prisma.dayProfile.deleteMany()
    await prisma.userSettings.deleteMany()
    await prisma.lifeGoal.updateMany({ data: { primaryGoalId: null } })
    await prisma.goal.deleteMany()
    await prisma.lifeGoal.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('the starter categories come once, and deleting them all does not bring them back', async () => {
    const owner = await register('starter@example.com')
    const first = await json(await request(owner, 'GET', '/api/day/context'))
    expect(first.categories.map((category: { title: string }) => category.title)).toEqual([
      'Работа',
      'Спорт',
      'Семья',
    ])
    for (const category of first.categories) {
      await request(owner, 'DELETE', `/api/day/categories/${category.id}`)
    }
    const again = await json(await request(owner, 'GET', '/api/day/context'))
    expect(again.categories).toEqual([])
  })

  test('a category is this person\'s own, and deleting it leaves templates working', async () => {
    const owner = await register('category-owner@example.com')
    const stranger = await register('category-stranger@example.com')
    const context = await json(await request(owner, 'GET', '/api/day/context'))
    const category = context.categories[0]
    const today = await personToday(owner)

    // Someone else's category, or none at all, is not found.
    const foreign = await request(stranger, 'POST', '/api/day/tasks', {
      scheduledOn: today,
      title: 'Чужая категория',
      categoryId: category.id,
    })
    expect(foreign.status).toBe(404)

    const templates = await json(
      await request(owner, 'POST', '/api/day/templates', { title: 'Будни' }),
    )
    const templateId = templates.templates[0].id
    await request(owner, 'POST', `/api/day/templates/${templateId}/items`, {
      title: 'Планёрка',
      startMinute: 600,
      categoryId: category.id,
    })
    const task = await createTask(owner, { scheduledOn: today, title: 'Отчёт', categoryId: category.id })

    // The category knows what uses it.
    const withUsage = await json(await request(owner, 'GET', '/api/day/context'))
    expect(withUsage.categories[0].usage).toEqual({ tasks: 1, templateItems: 1 })

    await request(owner, 'DELETE', `/api/day/categories/${category.id}`)
    const day = await json(await request(owner, 'GET', `/api/day/${today}`))
    expect(day.tasks.find((each: Task) => each.id === task.id).categoryId).toBeNull()

    const applied = await request(owner, 'POST', '/api/day/templates/apply', {
      templateId,
      scheduledOn: shift(today, 1),
    })
    expect(applied.status).toBe(200)
    const appliedDay = await applied.json()
    expect(appliedDay.tasks).toHaveLength(1)
    expect(appliedDay.tasks[0].categoryId).toBeNull()
  })

  test('a day that starts at 04:00 puts 01:00 at its end', async () => {
    const owner = await register('late@example.com')
    await request(owner, 'PATCH', '/api/settings', { dayStartMinute: 240 })
    const date = '2026-10-01'
    await createTask(owner, { scheduledOn: date, title: 'Ночь', startMinute: 60 })
    await createTask(owner, { scheduledOn: date, title: 'Утро', startMinute: 7 * 60 })
    await createTask(owner, { scheduledOn: date, title: 'Когда-нибудь' })
    const day = await json(await request(owner, 'GET', `/api/day/${date}`))
    expect(day.tasks.map((task: Task) => task.title)).toEqual(['Утро', 'Ночь', 'Когда-нибудь'])
  })

  test('a task moves to another day from its card', async () => {
    const owner = await register('move@example.com')
    const task = await createTask(owner, { scheduledOn: '2026-10-01', title: 'Перенести' })
    const moved = await json(
      await request(owner, 'PATCH', `/api/day/tasks/${task.id}`, { scheduledOn: '2026-10-03' }),
    )
    expect(moved.task.scheduledOn).toBe('2026-10-03')
    expect((await json(await request(owner, 'GET', '/api/day/2026-10-01'))).tasks).toEqual([])
  })

  test('a goal step goes into the plan with its estimate, but not once the goal is closed', async () => {
    const owner = await register('step-plan@example.com')
    const today = await personToday(owner)
    await request(owner, 'PUT', '/api/goals/life-goal', { title: 'Дело' })
    const goal = await json(
      await request(owner, 'POST', '/api/goals/goals', {
        title: 'Марафон',
        deadline: shift(today, 100),
        measureUnit: 'км',
        targetValue: 42,
        stages: [{ title: 'Этап', steps: [{ title: 'Длинная пробежка', estimatedMinutes: 90 }] }],
      }),
    )
    const stepId = goal.goal.stages[0].steps[0].id

    const planned = await createTask(owner, {
      scheduledOn: shift(today, 1),
      title: 'Длинная пробежка',
      stepId,
    })
    expect(planned.durationMinutes).toBe(90)
    await createTask(owner, { scheduledOn: shift(today, 3), title: 'Ещё раз', stepId })

    const plans = await json(await request(owner, 'GET', '/api/day/step-plans'))
    expect(plans.plans).toEqual([
      { stepId, scheduledOn: shift(today, 1) },
      { stepId, scheduledOn: shift(today, 3) },
    ])

    await request(owner, 'POST', `/api/goals/goals/${goal.goal.id}/close`, {
      status: 'completed',
      outcomeNote: 'Готово',
    })
    const refused = await request(owner, 'POST', '/api/day/tasks', {
      scheduledOn: today,
      title: 'Шаг закрытой цели',
      stepId,
    })
    expect(refused.status).toBe(404)
  })

  test('a repeat lands on its weekdays only, once, and each occurrence lives on its own', async () => {
    const owner = await register('repeat@example.com')
    const today = await personToday(owner)
    const first = await createTask(owner, { scheduledOn: today, title: 'Зарядка', startMinute: 420 })
    const days = [weekday(today), (weekday(today) + 2) % 7, (weekday(today) + 4) % 7]

    const repeated = await json(
      await request(owner, 'PUT', `/api/day/tasks/${first.id}/repeat`, {
        rule: { kind: 'weekdays', weekdays: days },
      }),
    )
    expect(repeated.task.repeat.rule).toEqual({ kind: 'weekdays', weekdays: [...days].sort((a, b) => a - b) })

    const occurrences = async () =>
      prisma.task.findMany({
        where: { seriesId: repeated.task.repeat.seriesId, deletedAt: null },
        orderBy: { scheduledOn: 'asc' },
      })
    const made = await occurrences()
    expect(made.every((task) => days.includes(task.scheduledOn.getUTCDay()))).toBe(true)
    expect(made.length).toBeGreaterThanOrEqual(6)

    // Making them again adds nothing: opening days and the background pass are idempotent.
    await materializeUpcomingPlans(prisma, new Date())
    for (const task of made) {
      await request(owner, 'GET', `/api/day/${task.scheduledOn.toISOString().slice(0, 10)}`)
    }
    expect((await occurrences()).length).toBe(made.length)

    // Completing one occurrence leaves the others planned.
    const second = made[1]!
    await request(owner, 'PATCH', `/api/day/tasks/${second.id}`, { isCompleted: true })
    expect((await occurrences()).filter((task) => task.outcome === 'done')).toHaveLength(1)

    // «Эта и следующие» renames the later occurrences; the earlier ones stay as they were.
    const third = made[2]!
    await request(owner, 'PATCH', `/api/day/tasks/${third.id}`, {
      title: 'Зарядка и растяжка',
      scope: 'following',
    })
    const renamed = await occurrences()
    expect(renamed[0]!.title).toBe('Зарядка')
    expect(renamed.slice(2).every((task) => task.title === 'Зарядка и растяжка')).toBe(true)

    // Deleting one occurrence takes that day out of the series for good.
    const fourth = made[3]!
    await request(owner, 'DELETE', `/api/day/tasks/${fourth.id}`)
    await prisma.task.delete({ where: { id: fourth.id } })
    await materializeUpcomingPlans(prisma, new Date())
    await request(owner, 'GET', `/api/day/${fourth.scheduledOn.toISOString().slice(0, 10)}`)
    expect((await occurrences()).map((task) => task.id)).not.toContain(fourth.id)
    expect(
      (await occurrences()).some((task) => task.seriesDate?.getTime() === fourth.seriesDate?.getTime()),
    ).toBe(false)

    // «Эта и следующие» on deletion ends the series there.
    const fifth = made[4]!
    await request(owner, 'DELETE', `/api/day/tasks/${fifth.id}?scope=following`)
    const left = await occurrences()
    expect(left.every((task) => task.scheduledOn < fifth.scheduledOn)).toBe(true)
  })

  test('chosen dates repeat on exactly those dates, and a goal step never repeats', async () => {
    const owner = await register('dates@example.com')
    const today = await personToday(owner)
    const task = await createTask(owner, { scheduledOn: today, title: 'Врач' })
    const dates = [shift(today, 2), shift(today, 9)]
    const repeated = await json(
      await request(owner, 'PUT', `/api/day/tasks/${task.id}/repeat`, {
        rule: { kind: 'dates', dates: [shift(today, -5), ...dates] },
      }),
    )
    const made = await prisma.task.findMany({
      where: { seriesId: repeated.task.repeat.seriesId },
      orderBy: { scheduledOn: 'asc' },
    })
    // The first task stays; past dates make nothing.
    expect(made.map((each) => each.scheduledOn.toISOString().slice(0, 10))).toEqual([today, ...dates])

    await request(owner, 'PUT', '/api/goals/life-goal', { title: 'Дело' })
    const goal = await json(
      await request(owner, 'POST', '/api/goals/goals', {
        title: 'Цель',
        deadline: shift(today, 30),
        measureUnit: 'шт',
        targetValue: 1,
        stages: [{ title: 'Этап', steps: [{ title: 'Шаг' }] }],
      }),
    )
    const stepTask = await createTask(owner, {
      scheduledOn: today,
      title: 'Шаг',
      stepId: goal.goal.stages[0].steps[0].id,
    })
    const refused = await request(owner, 'PUT', `/api/day/tasks/${stepTask.id}/repeat`, {
      rule: { kind: 'daily' },
    })
    expect(refused.status).toBe(409)
    expect((await refused.json()).error.code).toBe('TASK_STEP_CANNOT_REPEAT')
  })

  test('a template with a rule applies itself once a day and never brings a deleted task back', async () => {
    const owner = await register('template-rule@example.com')
    const today = await personToday(owner)
    const created = await json(
      await request(owner, 'POST', '/api/day/templates', { title: 'Каждый день' }),
    )
    const templateId = created.templates[0].id
    await request(owner, 'POST', `/api/day/templates/${templateId}/items`, { title: 'Разбор почты' })
    const withRule = await json(
      await request(owner, 'PATCH', `/api/day/templates/${templateId}`, {
        title: 'Каждое утро',
        rule: { kind: 'daily' },
      }),
    )
    expect(withRule.templates[0]).toMatchObject({ title: 'Каждое утро', rule: { kind: 'daily' } })

    const day = await json(await request(owner, 'GET', `/api/day/${today}`))
    expect(day.tasks.map((task: Task) => task.title)).toEqual(['Разбор почты'])
    const again = await json(await request(owner, 'GET', `/api/day/${today}`))
    expect(again.tasks).toHaveLength(1)

    await request(owner, 'DELETE', `/api/day/tasks/${day.tasks[0].id}`)
    const afterDelete = await json(await request(owner, 'GET', `/api/day/${today}`))
    expect(afterDelete.tasks).toEqual([])

    const applied = await json(await request(owner, 'GET', `/api/day/${today}/applied-templates`))
    expect(applied.templateIds).toEqual([templateId])

    // A past day is never filled after the fact.
    const past = await json(await request(owner, 'GET', `/api/day/${shift(today, -3)}`))
    expect(past.tasks).toEqual([])
  })

  test('a template item changes, and a day can be saved as a template', async () => {
    const owner = await register('template-edit@example.com')
    const created = await json(await request(owner, 'POST', '/api/day/templates', { title: 'Выходной' }))
    const templateId = created.templates[0].id
    const withItem = await json(
      await request(owner, 'POST', `/api/day/templates/${templateId}/items`, { title: 'Сон' }),
    )
    const itemId = withItem.templates[0].items[0].id
    const changed = await json(
      await request(owner, 'PATCH', `/api/day/template-items/${itemId}`, {
        title: 'Долгий сон',
        startMinute: 540,
        durationMinutes: 60,
      }),
    )
    expect(changed.templates[0].items[0]).toMatchObject({
      title: 'Долгий сон',
      startMinute: 540,
      durationMinutes: 60,
    })

    await createTask(owner, { scheduledOn: '2026-10-10', title: 'Рынок', startMinute: 600 })
    await createTask(owner, { scheduledOn: '2026-10-10', title: 'Кино', startMinute: 1140 })
    const saved = await json(
      await request(owner, 'POST', '/api/day/templates/from-day', {
        title: 'Суббота',
        date: '2026-10-10',
      }),
    )
    const saturday = saved.templates.find((template: { title: string }) => template.title === 'Суббота')
    expect(saturday.items.map((item: { title: string }) => item.title)).toEqual(['Рынок', 'Кино'])
  })

  async function personToday(accessToken: string) {
    const settings = await json(await request(accessToken, 'GET', '/api/settings'))
    return settings.clock.today as string
  }

  async function createTask(accessToken: string, body: Record<string, unknown>) {
    const response = await request(accessToken, 'POST', '/api/day/tasks', body)
    expect(response.status).toBe(201)
    return (await response.json()).task as Task
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
