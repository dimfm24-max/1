import type { PersonClock, UpdateSettingsRequest, UserSettingsDto } from '@dilife/contracts'

import type { AuthenticatedPrincipal } from '../../auth'
import { SettingsFailure } from '../domain/errors'
import { effectiveTimeZone, isKnownTimeZone, planDate, wallClock } from '../domain/local-day'
import type { Clock, SettingsRepository } from './ports'

type SettingsServiceDependencies = {
  clock: Clock
  repository: SettingsRepository
}

/**
 * Owns the person's preferences and the one answer every other module needs from them: which
 * day it is for this person right now.
 */
export class SettingsService {
  constructor(private readonly dependencies: SettingsServiceDependencies) {}

  read(userId: string): Promise<UserSettingsDto> {
    return this.dependencies.repository.read(userId)
  }

  async readWithClock(principal: AuthenticatedPrincipal) {
    const settings = await this.read(principal.id)
    return { settings, clock: this.clockFor(settings) }
  }

  async update(principal: AuthenticatedPrincipal, input: UpdateSettingsRequest) {
    // An unknown zone would break every day computed for this person, so it is refused here
    // rather than stored and discovered later by a background job.
    if (input.timeZone !== undefined && !isKnownTimeZone(input.timeZone)) {
      throw new SettingsFailure('unknown_time_zone', 'Unknown time zone')
    }
    const settings = await this.dependencies.repository.update(principal.id, input)
    return { settings, clock: this.clockFor(settings) }
  }

  /** `YYYY-MM-DD` of the plan the person is living now, by their zone and day start. */
  async today(userId: string): Promise<string> {
    const settings = await this.read(userId)
    return planDate(this.dependencies.clock.now(), settings)
  }

  clockFor(settings: UserSettingsDto): PersonClock {
    const timeZone = effectiveTimeZone(settings.timeZone)
    const now = this.dependencies.clock.now()
    return {
      today: planDate(now, settings),
      minuteOfDay: wallClock(now, timeZone).minuteOfDay,
      timeZone,
    }
  }
}
