import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { MeResponse } from '@dilife/contracts'

import { authQueryKeys, useAuth } from '@/features/auth'
import { completeOnboarding, updateProfile } from './api'

export function useUpdateProfileMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (displayName: string | null) =>
      updateProfile(auth.transport, { displayName }),
    onSuccess: (response) => {
      queryClient.setQueryData(
        authQueryKeys.me(),
        { user: response.user } satisfies MeResponse,
      )
    },
  })
}

/** Marks the wizard done and puts the updated account in place, so the guard lets /app open. */
export function useCompleteOnboardingMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => completeOnboarding(auth.transport),
    onSuccess: (response) => {
      queryClient.setQueryData(authQueryKeys.me(), { user: response.user } satisfies MeResponse)
    },
  })
}
