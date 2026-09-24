import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../../app'
import { createPrisma } from '../../db'
import { loadEnv } from '../../env'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

type SettingsView = {
  settings: { dayStartMinute: number; timeZone?: string | null; tone: string }
  clock: { today: string; minuteOfDay: number; timeZone: string }
}

maybeDescribe('settings API integration', () => {
  const env = loadEnv({
    DATABASE_URL: databaseUrl!,
    ACCESS_TOKEN_TTL_SECONDS: '60',
    CORS_ORIGINS: 'http://localhost:5173',
    JWT_SECRET: '12345678901234567890123456789012',
  })
  const prisma = createPrisma(databaseUrl!)
  let now = new Date('2026-09-23T09:00:00.000Z')
  const app = createApp({ env, prisma, clock: { now: () => now } })

  beforeEach(async () => {
    now = new Date('2026-09-23T09:00:00.000Z')
    await prisma.task.deleteMany()
    await prisma.userSettings.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('a new account has no zone yet and is read in the fallback zone', async () => {
    const owner = await register('fresh@example.com')
    const view = await read(owner)
    expect(view.settings.timeZone).toBeNull()
    expect(view.clock.timeZone).toBe('Europe/Moscow')
    // 09:00 UTC is 12:00 in Moscow.
    expect(view.clock).toMatchObject({ today: '2026-09-23', minuteOfDay: 12 * 60 })
  })

  test('the browser zone is saved and moves the clock with it', async () => {
    const owner = await register('zone@example.com')
    // 23:30 UTC on 23 September is already 24 September in Tokyo.
    now = new Date('2026-09-23T23:30:00.000Z')
    const saved = await update(owner, { timeZone: 'Asia/Tokyo' })
    expect(saved.status).toBe(200)
    const view = (await saved.json()) as SettingsView
    expect(view.settings.timeZone).toBe('Asia/Tokyo')
    expect(view.clock).toMatchObject({ today: '2026-09-24', timeZone: 'Asia/Tokyo' })
  })

  test('an unknown zone is refused and the saved one stays', async () => {
    const owner = await register('unknown@example.com')
    await update(owner, { timeZone: 'Europe/Berlin' })
    const refused = await update(owner, { timeZone: 'Mars/Olympus' })
    expect(refused.status).toBe(400)
    expect((await refused.json()).error.code).toBe('VALIDATION_ERROR')
    expect((await read(owner)).settings.timeZone).toBe('Europe/Berlin')
  })

  test('before a 04:00 day start the previous plan is still today', async () => {
    const owner = await register('late@example.com')
    await update(owner, { timeZone: 'Europe/Moscow', dayStartMinute: 240 })
    // 23:30 UTC on 23 September is 02:30 on 24 September in Moscow.
    now = new Date('2026-09-23T23:30:00.000Z')
    expect((await read(owner)).clock.today).toBe('2026-09-23')
    now = new Date('2026-09-24T01:00:00.000Z')
    expect((await read(owner)).clock.today).toBe('2026-09-24')
  })

  test('changing the zone does not move tasks to other dates', async () => {
    const owner = await register('travel@example.com')
    const created = await request(owner, 'POST', '/api/day/tasks', {
      scheduledOn: '2026-09-23',
      title: 'Пробежка',
      startMinute: 480,
    })
    expect(created.status).toBe(201)
    await update(owner, { timeZone: 'America/New_York' })
    const day = await (await request(owner, 'GET', '/api/day/2026-09-23')).json()
    expect(day.tasks.map((task: { title: string }) => task.title)).toEqual(['Пробежка'])
  })

  test('the old day settings route still writes, for tabs opened before the release', async () => {
    const owner = await register('legacy@example.com')
    const response = await request(owner, 'PATCH', '/api/day/settings', { tone: 'neutral' })
    expect(response.status).toBe(200)
    expect(Object.keys(await response.json())).toEqual(['settings'])
    expect((await read(owner)).settings.tone).toBe('neutral')
  })

  test('settings need a signed-in person', async () => {
    expect((await app.request('/api/settings')).status).toBe(401)
  })

  async function read(accessToken: string) {
    const response = await request(accessToken, 'GET', '/api/settings')
    expect(response.status).toBe(200)
    return (await response.json()) as SettingsView
  }

  function update(accessToken: string, body: unknown) {
    return request(accessToken, 'PATCH', '/api/settings', body)
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
