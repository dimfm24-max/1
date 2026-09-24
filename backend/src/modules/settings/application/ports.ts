import type { UpdateSettingsRequest, UserSettingsDto } from '@dilife/contracts'

export type SettingsRepository = {
  /** The person's settings, creating the row with defaults on first read. */
  read(userId: string): Promise<UserSettingsDto>
  update(userId: string, input: UpdateSettingsRequest): Promise<UserSettingsDto>
}

export type Clock = {
  now(): Date
}
