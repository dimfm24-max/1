import {
  trashListResponseSchema,
  trashPurgeResponseSchema,
  trashRestoreResponseSchema,
  type TrashKind,
} from '@dilife/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

export function fetchTrash(transport: AuthenticatedTransport, options?: { signal?: AbortSignal }) {
  return transport.request('/api/trash', trashListResponseSchema, { signal: options?.signal })
}

export function restoreFromTrash(transport: AuthenticatedTransport, kind: TrashKind, id: string) {
  return transport.request(`/api/trash/${kind}/${id}/restore`, trashRestoreResponseSchema, {
    method: 'POST',
  })
}

export function purgeFromTrash(transport: AuthenticatedTransport, kind: TrashKind, id: string) {
  return transport.request(`/api/trash/${kind}/${id}`, trashPurgeResponseSchema, {
    method: 'DELETE',
  })
}
