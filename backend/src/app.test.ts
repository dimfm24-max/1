import { expect, test } from 'bun:test'

import type { DbClient } from './db'
import { loadEnv } from './env'
import { createApp } from './app'

const env = loadEnv({
  DATABASE_URL: 'postgresql://superuser:superpassword@localhost:54329/dilife',
  JWT_SECRET: '12345678901234567890123456789012',
})


function createHealthTestApp({ databaseAvailable }: { databaseAvailable: boolean }) {
  let queries = 0
  const prisma = {
    $queryRaw: async () => {
      queries += 1
      // Yield once so concurrent probes overlap the way a real round-trip would.
      await Promise.resolve()
      if (!databaseAvailable) throw new Error('database unavailable')
      return [{ '?column?': 1 }]
    },
  } as unknown as DbClient

  return {
    app: createApp({ env, prisma }),
    get queries() {
      return queries
    },
  }
}

test('concurrent readiness probes share one database query while liveness never touches it', async () => {
  // `/health/ready` sits outside every rate limiter, so a GET flood must not turn into a flood of
  // pool connections. `http/readiness.test.ts` owns the window arithmetic; this proves the wiring:
  // N overlapping probes cost one query and all report the same answer.
  const harness = createHealthTestApp({ databaseAvailable: true })
  const probes = 25

  const responses = await Promise.all(
    Array.from({ length: probes }, () => harness.app.request('/health/ready')),
  )

  expect(responses.map((response) => response.status)).toEqual(Array(probes).fill(200))
  expect(harness.queries).toBe(1)

  // A cached success answers the next probe inside the window without another query.
  expect((await harness.app.request('/health/ready')).status).toBe(200)
  expect(harness.queries).toBe(1)

  expect((await harness.app.request('/health/live')).status).toBe(200)
  expect((await harness.app.request('/health')).status).toBe(200)
  expect(harness.queries).toBe(1)
})

test('readiness reports 503 while the database probe fails, and liveness stays 200', async () => {
  const harness = createHealthTestApp({ databaseAvailable: false })

  const responses = await Promise.all(
    Array.from({ length: 5 }, () => harness.app.request('/health/ready')),
  )

  expect(responses.map((response) => response.status)).toEqual(Array(5).fill(503))
  expect(await responses[0]!.json()).toEqual({ status: 'unavailable' })
  expect(harness.queries).toBe(1)
  expect((await harness.app.request('/health/live')).status).toBe(200)
  expect((await harness.app.request('/health')).status).toBe(200)
})

test('CORS preflight allows the standard mutation methods exposed by the client transport', async () => {
  const prisma = { $queryRaw: async () => [{ '?column?': 1 }] } as unknown as DbClient
  const app = createApp({ env, prisma })
  const response = await app.request('/api/future-resource', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'PATCH',
    },
  })

  expect(response.status).toBe(204)
  expect(response.headers.get('access-control-allow-methods')).toContain('PATCH')
})

test('account mutations reject oversized bodies before authentication', async () => {
  const app = createApp({
    env: { ...env, AUTH_BODY_LIMIT_BYTES: 32 },
    prisma: {} as DbClient,
  })
  const request = (path: string) => app.request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: 'x'.repeat(64) }),
  })

  expect((await request('/api/users/me')).status).toBe(413)
})

test('account mutations share bounded write-rate protection', async () => {
  const app = createApp({
    env: { ...env, API_RATE_LIMIT_MAX: 1 },
    prisma: {} as DbClient,
  })
  const request = (path: string) => app.request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })

  expect((await request('/api/users/me')).status).toBe(401)
  const limited = await request('/api/users/me')
  expect(limited.status).toBe(429)
  expect(limited.headers.get('retry-after')).toBeTruthy()
})

test('Yandex SWS ingress delegates IP request limits while retaining body limits', async () => {
  const externalEnv = {
    ...env,
    AUTH_BODY_LIMIT_BYTES: 32,
    AUTH_RATE_LIMIT_MAX: 1,
    INGRESS_RATE_LIMIT_PROVIDER: 'yandex-sws' as const,
    TRUST_PROXY: true,
    TRUSTED_PROXY_CLIENT_IP_HEADER: 'x-forwarded-for',
    TRUSTED_PROXY_CLIENT_IP_POSITION: 'last' as const,
  }
  const app = createApp({ env: externalEnv, prisma: {} as DbClient })
  const requests = [
    { expectedStatus: 400, send: () => app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }) },
    { expectedStatus: 401, send: () => app.request('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }) },
  ]

  for (const request of requests) {
    expect((await request.send()).status).toBe(request.expectedStatus)
    expect((await request.send()).status).toBe(request.expectedStatus)
  }

  // Delegating IP budgets to the edge must not delegate body limits with them. Proven on an
  // account mutation, which is capability-neutral and stays mounted.
  const oversized = await app.request('/api/users/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: 'x'.repeat(64) }),
  })

  expect(oversized.status).toBe(413)
})
