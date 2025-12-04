/**
 * useUserSettings Hook
 * React hook for managing user settings including LLM API keys
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getOrCreateUserSettings,
  updateUserSettings,
  hasLLMApiKey
} from "../services/user-settings"
import type { UserSettings, UpdateUserSettingsInput } from "../types/user-settings"
import { isSelfHostedMode } from "../config/deployment"

/**
 * Hook for managing user settings
 */
export function useUserSettings(userId: string | null) {
  const queryClient = useQueryClient()

  // Query for user settings
  const {
    data: settings,
    isLoading,
    error
  } = useQuery<UserSettings | null>({
    queryKey: ["user-settings", userId],
    queryFn: () => (userId ? getOrCreateUserSettings(userId) : null),
    enabled: !!userId && isSelfHostedMode() // Only fetch in self-hosted mode
  })

  // Query for API key status (without exposing the key)
  const {
    data: hasApiKey,
    refetch: refetchHasApiKey
  } = useQuery<boolean>({
    queryKey: ["user-settings-has-api-key", userId],
    queryFn: () => (userId ? hasLLMApiKey(userId) : Promise.resolve(false)),
    enabled: !!userId && isSelfHostedMode()
  })

  // Mutation for updating settings
  const updateMutation = useMutation({
    mutationFn: async (input: UpdateUserSettingsInput) => {
      if (!userId) {
        throw new Error("User ID is required")
      }
      return updateUserSettings(userId, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-settings", userId] })
      queryClient.invalidateQueries({ queryKey: ["user-settings-has-api-key", userId] })
    }
  })

  return {
    // Settings data
    settings,
    isLoading,
    error,
    hasApiKey: hasApiKey ?? false,

    // Actions
    updateSettings: (input: UpdateUserSettingsInput) => updateMutation.mutate(input),
    refetchHasApiKey,

    // Mutation states
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error
  }
}

