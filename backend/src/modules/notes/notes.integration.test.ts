import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../../app'
import { createPrisma } from '../../db'
import { loadEnv } from '../../env'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

type NoteView = { id: string; title: string | null; body: string; goalId: string | null }

maybeDescribe('notes API integration', () => {
  const env = loadEnv({
    DATABASE_URL: databaseUrl!,
    ACCESS_TOKEN_TTL_SECONDS: '60',
    CORS_ORIGINS: 'http://localhost:5173',
    JWT_SECRET: '12345678901234567890123456789012',
  })
  const prisma = createPrisma(databaseUrl!)
  const app = createApp({ env, prisma })

  beforeEach(async () => {
    await prisma.note.deleteMany()
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

  test('a note may stand alone or hang off a goal', async () => {
    const owner = await register('notes-free@example.com')
    const goalId = await createGoal(owner)

    const free = await createNote(owner, { body: 'Мысль без цели' })
    const attached = await createNote(owner, { body: 'Мысль о цели', goalId })

    expect(free.goalId).toBeNull()
    expect(attached.goalId).toBe(goalId)

    const filtered = await list(owner, goalId)
    expect(filtered.map((note) => note.id)).toEqual([attached.id])
  })

  test('a note survives the goal it was attached to', async () => {
    const owner = await register('notes-outlive@example.com')
    const goalId = await createGoal(owner)
    const note = await createNote(owner, { body: 'Что я понял', goalId })

    // In the trash the goal can still come back, so the note keeps pointing at it; the screen
    // does not name a goal it cannot show.
    await request(owner, 'DELETE', `/api/goals/goals/${goalId}`)
    const whileTrashed = await list(owner)
    expect(whileTrashed.map((each) => each.id)).toEqual([note.id])
    expect(whileTrashed[0]?.goalId).toBe(goalId)

    // Gone for good: the note stays, the link goes.
    expect((await request(owner, 'DELETE', `/api/trash/goal/${goalId}`)).status).toBe(200)
    const notes = await list(owner)
    expect(notes).toHaveLength(1)
    expect(notes[0]?.id).toBe(note.id)
    expect(notes[0]?.goalId).toBeNull()
  })

  test('notes come back with the most recently touched first', async () => {
    const owner = await register('notes-order@example.com')
    const first = await createNote(owner, { body: 'Первая' })
    const second = await createNote(owner, { body: 'Вторая' })

    await request(owner, 'PATCH', `/api/notes/${first.id}`, { body: 'Первая, дополненная' })

    const notes = await list(owner)
    expect(notes.map((note) => note.id)).toEqual([first.id, second.id])
  })

  test('a note cannot be attached to another account\'s goal', async () => {
    const owner = await register('notes-owner@example.com')
    const stranger = await register('notes-stranger@example.com')
    const strangerGoalId = await createGoal(stranger)

    const refused = await request(owner, 'POST', '/api/notes', {
      body: 'Чужая цель',
      goalId: strangerGoalId,
    })

    expect(refused.status).toBe(404)
  })

  test('another account sees none of these notes', async () => {
    const owner = await register('notes-private@example.com')
    const stranger = await register('notes-nosy@example.com')
    const note = await createNote(owner, { body: 'Личное' })

    expect(await list(stranger)).toEqual([])
    expect((await request(stranger, 'DELETE', `/api/notes/${note.id}`)).status).toBe(404)
  })

  test('an empty note is refused, and notes require a session', async () => {
    const owner = await register('notes-empty@example.com')

    expect((await request(owner, 'POST', '/api/notes', { body: '   ' })).status).toBe(400)
    expect((await app.request('/api/notes')).status).toBe(401)
  })

  async function createGoal(accessToken: string) {
    await request(accessToken, 'PUT', '/api/goals/life-goal', { title: 'Дело жизни' })
    const goal = await (
      await request(accessToken, 'POST', '/api/goals/goals', {
        title: 'Цель',
        deadline: '2027-01-01T00:00:00.000Z',
        measureUnit: 'шагов',
        targetValue: 10,
      })
    ).json()
    return goal.goal.id as string
  }

  async function createNote(accessToken: string, body: Record<string, unknown>) {
    const response = await request(accessToken, 'POST', '/api/notes', body)
    expect(response.status).toBe(201)
    return (await response.json()).note as NoteView
  }

  async function list(accessToken: string, goalId?: string) {
    const response = await request(
      accessToken,
      'GET',
      goalId === undefined ? '/api/notes' : `/api/notes?goalId=${goalId}`,
    )
    expect(response.status).toBe(200)
    return (await response.json()).notes as NoteView[]
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
