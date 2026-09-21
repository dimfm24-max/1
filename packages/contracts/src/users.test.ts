import { describe, expect, test } from 'bun:test'

import { updateProfileRequestSchema, userSchema } from './index'

const user = {
  id: '019c0000-0000-7000-8000-000000000001',
  email: 'user@example.com',
  displayName: 'User',
  createdAt: '2026-07-20T00:00:00.000Z',
} as const

describe('user contracts', () => {
  test('accepts a user DTO and rejects unknown identity fields', () => {
    expect(userSchema.parse(user)).toEqual(user)
    expect(() => userSchema.parse({ ...user, id: undefined })).toThrow()
  })

  test('normalizes profile updates and allows explicitly clearing the display name', () => {
    expect(updateProfileRequestSchema.parse({ displayName: '  Jane Doe  ' })).toEqual({
      displayName: 'Jane Doe',
    })
    expect(updateProfileRequestSchema.parse({ displayName: null })).toEqual({ displayName: null })
    expect(() => updateProfileRequestSchema.parse({ displayName: 'A' })).toThrow()
    expect(() => updateProfileRequestSchema.parse({ displayName: '' })).toThrow()
    expect(() =>
      updateProfileRequestSchema.parse({ displayName: 'Jane', extra: true }),
    ).toThrow()
  })
})
