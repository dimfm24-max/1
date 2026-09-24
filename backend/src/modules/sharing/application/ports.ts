import type {
  CreateCommentRequest,
  PublicProfileResponse,
  ShareCommentDto,
  ShareSettingsDto,
  UpdateShareRequest,
} from '@dilife/contracts'

export type SharingRepository = {
  settingsFor(userId: string): Promise<ShareSettingsDto>
  enable(userId: string): Promise<ShareSettingsDto>
  rotate(userId: string): Promise<ShareSettingsDto>
  disable(userId: string): Promise<ShareSettingsDto>
  updateSettings(userId: string, input: UpdateShareRequest): Promise<ShareSettingsDto>
  /** Whose page a token opens, or null when no link has it. */
  ownerOf(token: string): Promise<string | null>
  readPublicProfile(token: string, today: string): Promise<PublicProfileResponse>
  addComment(token: string, input: CreateCommentRequest): Promise<ShareCommentDto[]>
  deleteComment(userId: string, commentId: string): Promise<ShareCommentDto[]>
}
