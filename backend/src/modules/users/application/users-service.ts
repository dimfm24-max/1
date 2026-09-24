import type { UpdateProfileRequest, UserDto } from '@dilife/contracts'

import type { AuthenticatedPrincipal } from '../../auth'
import type { ProfileWriter, UserRecord } from './ports'

type UsersServiceDependencies = {
  profileWriter: ProfileWriter
  clock?: { now(): Date }
}

export class UsersService {
  constructor(private readonly dependencies: UsersServiceDependencies) {}

  async updateProfile(principal: AuthenticatedPrincipal, input: UpdateProfileRequest) {
    const user = await this.dependencies.profileWriter.updateProfile(
      principal.id,
      input.displayName,
    )
    return {
      user: this.userDto(user),
    }
  }

  /** The first-run wizard is done: from now on /app opens as usual (task 07). */
  async completeOnboarding(principal: AuthenticatedPrincipal) {
    const now = this.dependencies.clock?.now() ?? new Date()
    const user = await this.dependencies.profileWriter.completeOnboarding(principal.id, now)
    return { user: this.userDto(user) }
  }

  private userDto(user: UserRecord): UserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
      emailVerified: user.emailVerifiedAt !== null,
      onboardingCompleted: user.onboardingCompletedAt !== null,
    }
  }
}
