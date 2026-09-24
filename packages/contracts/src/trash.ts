import { z } from 'zod'

/** How long a deleted item waits in the trash before it is gone for good (task 11). */
export const TRASH_RETENTION_DAYS = 30

/** The six kinds of things that go to the trash (owner's decision on task 11). */
export const trashKindSchema = z.enum(['goal', 'stage', 'step', 'task', 'note', 'habit'])

export const trashItemSchema = z.object({
  kind: trashKindSchema,
  id: z.string(),
  title: z.string(),
  /** The goal a stage or step belongs to, so two steps named alike can be told apart. */
  parentTitle: z.string().nullable(),
  /** `YYYY-MM-DD` of the day a task was planned for; null for other kinds. */
  day: z.string().nullable(),
  deletedAt: z.string().datetime(),
  /** When the item will be removed for good. */
  purgeAt: z.string().datetime(),
})

export const trashListResponseSchema = z
  .object({
    items: z.array(trashItemSchema),
  })
  .strict()

/**
 * What came back. Restoring a step whose stage or goal is also in the trash brings them back
 * too, and the answer lists them so the person is told.
 */
export const trashRestoreResponseSchema = z
  .object({
    restored: z.array(trashItemSchema),
  })
  .strict()

export const trashPurgeResponseSchema = z
  .object({
    purged: z.literal(true),
  })
  .strict()

export const trashItemParamsSchema = z
  .object({
    kind: trashKindSchema,
    id: z.uuid(),
  })
  .strict()

export type TrashKind = z.infer<typeof trashKindSchema>
export type TrashItemDto = z.infer<typeof trashItemSchema>
export type TrashListResponse = z.infer<typeof trashListResponseSchema>
export type TrashRestoreResponse = z.infer<typeof trashRestoreResponseSchema>
