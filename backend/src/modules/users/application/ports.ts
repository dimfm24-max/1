export type UserRecord = {
  id: string
  email: string
  displayName: string | null
  emailVerifiedAt: Date | null
  onboardingCompletedAt: Date | null
  createdAt: Date
}

export type ProfileWriter = {
  updateProfile(userId: string, displayName: string | null): Promise<UserRecord>
  /** Marks the wizard finished; a second call keeps the first moment. */
  completeOnboarding(userId: string, now: Date): Promise<UserRecord>
}
