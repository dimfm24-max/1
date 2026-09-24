import { TRASH_RETENTION_DAYS, type TrashItemDto, type TrashKind } from '@dilife/contracts'

import type { AuthenticatedPrincipal } from '../../auth'

/** One item as a module reports it. The trash adds the purge date; modules know only deletion. */
export type TrashEntry = {
  kind: TrashKind
  id: string
  title: string
  parentTitle: string | null
  day: string | null
  deletedAt: Date
}

/**
 * What a module that sends things to the trash offers the trash. Each module owns its rows and
 * the rules for bringing them back; the trash only lists, dispatches and sweeps.
 */
export type TrashSource = {
  kinds: ReadonlyArray<TrashKind>
  list(userId: string): Promise<TrashEntry[]>
  /** Null when there is no such item of this person's in the trash. */
  restore(userId: string, kind: never, id: string): Promise<TrashEntry[] | null>
  purge(userId: string, kind: never, id: string): Promise<boolean>
  /** Removes items deleted before `before`, at most `limit`; answers how many went. */
  purgeExpired(before: Date, limit: number): Promise<number>
}

export class TrashNotFound extends Error {
  constructor() {
    super('Nothing like that is in the trash')
    this.name = 'TrashNotFound'
  }
}

const dayMs = 24 * 60 * 60 * 1000

export function trashCutoff(now: Date): Date {
  return new Date(now.getTime() - TRASH_RETENTION_DAYS * dayMs)
}

export class TrashService {
  constructor(
    private readonly dependencies: { clock: { now(): Date }; sources: ReadonlyArray<TrashSource> },
  ) {}

  async list(principal: AuthenticatedPrincipal) {
    const lists = await Promise.all(
      this.dependencies.sources.map((source) => source.list(principal.id)),
    )
    const items = lists
      .flat()
      .sort((left, right) => right.deletedAt.getTime() - left.deletedAt.getTime())
      .map(toDto)
    return { items }
  }

  async restore(principal: AuthenticatedPrincipal, kind: TrashKind, id: string) {
    const restored = await this.sourceFor(kind).restore(principal.id, kind as never, id)
    if (!restored) throw new TrashNotFound()
    return { restored: restored.map(toDto) }
  }

  async purge(principal: AuthenticatedPrincipal, kind: TrashKind, id: string) {
    const removed = await this.sourceFor(kind).purge(principal.id, kind as never, id)
    if (!removed) throw new TrashNotFound()
  }

  private sourceFor(kind: TrashKind) {
    const source = this.dependencies.sources.find((candidate) => candidate.kinds.includes(kind))
    if (!source) throw new TrashNotFound()
    return source
  }
}

/**
 * The 30-day sweep, in batches so one pass never holds the database for long. Runs inside
 * `maintenance:process`, which already holds the job lock, so two runners never sweep together.
 */
export async function purgeExpiredTrash(
  sources: ReadonlyArray<TrashSource>,
  now: Date,
  { batchLimit = 500 }: { batchLimit?: number } = {},
) {
  const before = trashCutoff(now)
  let removed = 0
  for (const source of sources) removed += await source.purgeExpired(before, batchLimit)
  return removed
}

function toDto(entry: TrashEntry): TrashItemDto {
  return {
    kind: entry.kind,
    id: entry.id,
    title: entry.title,
    parentTitle: entry.parentTitle,
    day: entry.day,
    deletedAt: entry.deletedAt.toISOString(),
    purgeAt: new Date(entry.deletedAt.getTime() + TRASH_RETENTION_DAYS * dayMs).toISOString(),
  }
}
