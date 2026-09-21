import type { UpdateProfileRequest, UserDto } from '@dilife/contracts'

import type { AuthenticatedPrincipal } from '../../auth'
import type { ProfileWriter, UserRecord } from './ports'

type UsersServiceDependencies = {
  profileWriter: ProfileWriter
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

  private userDto(user: UserRecord): UserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
    }
  }
}
