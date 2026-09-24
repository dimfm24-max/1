import { z } from 'zod'

/**
 * How the app speaks to a person (§9 of PRD.md). The person picks one; every sentence the app
 * says to them - on screens and in notifications - comes in that tone, always addressing them
 * as «ты».
 */
export const tones = ['friendly', 'pushing', 'respectful', 'neutral'] as const
export const toneSchema = z.enum(tones)

/**
 * The places where the interface speaks in the person's tone. The texts live in the web client;
 * the list is shared so both sides, and the tests, agree on what must exist.
 */
export const interfaceToneKeys = [
  'todayLine',
  'dayEmpty',
  'daySummaryAllDone',
  'daySummaryLeft',
  'missedDays',
  'deadlineSoon',
  'deadlineLastDay',
  'deadlineOverdue',
  'horizon',
  'horizonPast',
  'goalCompleted',
  'goalAbandoned',
] as const

/** The notifications that speak in the person's tone. Their texts live on the server. */
export const notificationToneKeys = [
  'morningGreeting',
  'morningGreetingEmpty',
  'eveningSummary',
  'deadlineSoon',
  'deadlineLastDay',
] as const

export type Tone = z.infer<typeof toneSchema>
export type InterfaceToneKey = (typeof interfaceToneKeys)[number]
export type NotificationToneKey = (typeof notificationToneKeys)[number]
