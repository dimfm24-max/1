import { z } from 'zod'

import { MINUTES_IN_DAY, userSettingsSchema } from './day'

/**
 * The person's own clock, worked out on the server from their time zone and the minute their
 * day starts. Every screen reads "today" from here, so the plan, the habits and the statistics
 * can never disagree about which day it is.
 */
export const personClockSchema = z.object({
  /** `YYYY-MM-DD`: the day of the plan, which starts at the person's own day start. */
  today: z.string(),
  /** Minutes past midnight on the person's wall clock. */
  minuteOfDay: z.number().int().min(0).max(MINUTES_IN_DAY - 1),
  /** The zone actually used: the saved one, or the fallback while none is saved. */
  timeZone: z.string(),
})

export const settingsWithClockResponseSchema = z
  .object({
    settings: userSettingsSchema,
    clock: personClockSchema,
  })
  .strict()

export type PersonClock = z.infer<typeof personClockSchema>
export type SettingsWithClockResponse = z.infer<typeof settingsWithClockResponseSchema>
