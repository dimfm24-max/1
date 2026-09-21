export type UserRecord = {
  id: string
  email: string
  displayName: string | null
  createdAt: Date
}

export type ProfileWriter = {
  updateProfile(userId: string, displayName: string | null): Promise<UserRecord>
}
