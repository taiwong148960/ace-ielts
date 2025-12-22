/**
 * useUserSettings Hook
 * React hook for managing user settings
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getOrCreateUserSettings,
  updateUserSettings
} from "../services/user-settings"
import type { UserSettings, UpdateUserSettingsInput } from "../types/user-settings"

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
    enabled: !!userId
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
    }
  })

  return {
    // Settings data
    settings,
    isLoading,
    error,

    // Actions
    updateSettings: (input: UpdateUserSettingsInput) => updateMutation.mutate(input),

    // Mutation states
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error
  }
}

