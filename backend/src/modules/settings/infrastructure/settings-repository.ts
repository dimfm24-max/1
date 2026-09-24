import {
  DEFAULT_LIFE_EXPECTANCY_YEARS,
  type UpdateSettingsRequest,
  type UserSettingsDto,
} from '@dilife/contracts'

import type { DbClient } from '../../../db'
import { Prisma } from '../../../generated/prisma/client'
import type { SettingsRepository } from '../application/ports'

/**
 * A date column comes back as a Date at UTC midnight; both directions go through these helpers
 * rather than the local time zone, which would shift a birthday a day either way.
 */
function toDayDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`)
}

function fromDayDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

const settingsSelect = {
  dayStartMinute: true,
  defaultTaskMinutes: true,
  tone: true,
  birthDate: true,
  lifeExpectancy: true,
  timeZone: true,
} as const

export function createPrismaSettingsRepository(db: DbClient): SettingsRepository {
  /**
   * Two first reads at once - a screen asking for "today" and the settings together - both try to
   * create the row; the loser finds the winner's row instead of failing.
   */
  async function upsertSettingsRow(userId: string) {
    try {
      return await db.userSettings.upsert({
        where: { userId },
        create: { userId },
        update: {},
        select: settingsSelect,
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return db.userSettings.findUniqueOrThrow({ where: { userId }, select: settingsSelect })
      }
      throw error
    }
  }

  async function read(userId: string): Promise<UserSettingsDto> {
    // Created on first read rather than at registration: a row that exists only once someone
    // opens the app cannot go missing for accounts made before this feature existed.
    const settings = await upsertSettingsRow(userId)
    return {
      dayStartMinute: settings.dayStartMinute,
      defaultTaskMinutes: settings.defaultTaskMinutes,
      tone: settings.tone as UserSettingsDto['tone'],
      birthDate: settings.birthDate ? fromDayDate(settings.birthDate) : null,
      // Stored null means "not chosen": the horizon then counts to the default age, and a
      // PATCH with null returns the person to it.
      lifeExpectancy: settings.lifeExpectancy ?? DEFAULT_LIFE_EXPECTANCY_YEARS,
      timeZone: settings.timeZone,
    }
  }

  return {
    read,

    async update(userId, input: UpdateSettingsRequest) {
      await read(userId)
      await db.userSettings.update({
        where: { userId },
        data: {
          ...(input.dayStartMinute === undefined ? {} : { dayStartMinute: input.dayStartMinute }),
          ...(input.defaultTaskMinutes === undefined
            ? {}
            : { defaultTaskMinutes: input.defaultTaskMinutes }),
          ...(input.tone === undefined ? {} : { tone: input.tone }),
          ...(input.birthDate === undefined
            ? {}
            : { birthDate: input.birthDate === null ? null : toDayDate(input.birthDate) }),
          ...(input.lifeExpectancy === undefined
            ? {}
            : { lifeExpectancy: input.lifeExpectancy }),
          ...(input.timeZone === undefined ? {} : { timeZone: input.timeZone }),
        },
      })
      return read(userId)
    },
  }
}
