import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TrashKind } from '@dilife/contracts'

import { sessionQueryKeys, useAuth } from '@/features/auth'
import { fetchTrash, purgeFromTrash, restoreFromTrash } from './api'

export const trashQueryKeys = {
  list: () => [...sessionQueryKeys.all, 'trash', 'list'] as const,
}

export function useTrashQuery() {
  const auth = useAuth()
  return useQuery({
    queryKey: trashQueryKeys.list(),
    queryFn: ({ signal }) => fetchTrash(auth.transport, { signal }),
  })
}

/**
 * Brings something back. Whatever screen showed it has to show it again, and a restored step can
 * move a goal's number, so every screen's data is marked stale rather than guessing which care.
 */
export function useRestoreFromTrash() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kind, id }: { kind: TrashKind; id: string }) =>
      restoreFromTrash(auth.transport, kind, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.all,
        predicate: (query) => query.queryKey[1] !== 'auth' && query.queryKey[1] !== 'settings',
      })
    },
  })
}

export function usePurgeFromTrash() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kind, id }: { kind: TrashKind; id: string }) =>
      purgeFromTrash(auth.transport, kind, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: trashQueryKeys.list() })
    },
  })
}
