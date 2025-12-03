/**
 * Auth Context Provider
 * Provides authentication state and methods to the entire application
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode
} from "react"
import type { User, Session } from "@supabase/supabase-js"
import type { AuthContextValue, OAuthProvider, AuthState } from "../types/auth"
import {
  signInWithOAuth as authSignInWithOAuth,
  signOut as authSignOut,
  getSession,
  onAuthStateChange,
  refreshSession as authRefreshSession
} from "../services/auth"
import { isSupabaseInitialized } from "../services/supabase"

/**
 * Default auth state
 */
const defaultAuthState: AuthState = {
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false
}

/**
 * Default context value (for SSR/testing)
 */
const defaultAuthContext: AuthContextValue = {
  ...defaultAuthState,
  signInWithOAuth: async () => {},
  signOut: async () => {},
  refreshSession: async () => {}
}

/**
 * Auth context
 */
const AuthContext = createContext<AuthContextValue>(defaultAuthContext)

/**
 * Auth provider props
 */
interface AuthProviderProps {
  children: ReactNode
  /**
   * Custom redirect URL for OAuth callback
   */
  redirectTo?: string
  /**
   * Callback when auth state changes
   */
  onAuthStateChange?: (user: User | null) => void
}

/**
 * Auth provider component
 * Wrap your app with this to provide authentication functionality
 */
export function AuthProvider({
  children,
  redirectTo,
  onAuthStateChange: onAuthStateChangeCallback
}: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>(defaultAuthState)

  /**
   * Update auth state from session
   */
  const updateAuthState = useCallback(
    (session: Session | null, isLoading = false) => {
      const user = session?.user ?? null
      setAuthState({
        user,
        session,
        isLoading,
        isAuthenticated: !!user
      })
      onAuthStateChangeCallback?.(user)
    },
    [onAuthStateChangeCallback]
  )

  /**
   * Initialize auth state
   */
  useEffect(() => {
    // Skip if Supabase is not initialized
    if (!isSupabaseInitialized()) {
      setAuthState({
        ...defaultAuthState,
        isLoading: false
      })
      return
    }

    // Get initial session
    getSession()
      .then((session) => {
        updateAuthState(session, false)
      })
      .catch((error) => {
        console.error("Failed to get initial session:", error)
        setAuthState({
          ...defaultAuthState,
          isLoading: false
        })
      })

    // Subscribe to auth changes
    const { data: subscription } = onAuthStateChange((_event, session) => {
      updateAuthState(session as Session | null, false)
    })

    return () => {
      subscription?.subscription.unsubscribe()
    }
  }, [updateAuthState])

  /**
   * Sign in with OAuth provider
   */
  const signInWithOAuth = useCallback(
    async (provider: OAuthProvider) => {
      try {
        await authSignInWithOAuth(provider, redirectTo)
      } catch (error) {
        console.error("Sign in error:", error)
        throw error
      }
    },
    [redirectTo]
  )

  /**
   * Sign out
   */
  const signOut = useCallback(async () => {
    try {
      await authSignOut()
      updateAuthState(null, false)
    } catch (error) {
      console.error("Sign out error:", error)
      throw error
    }
  }, [updateAuthState])

  /**
   * Refresh session
   */
  const refreshSession = useCallback(async () => {
    try {
      const session = await authRefreshSession()
      updateAuthState(session, false)
    } catch (error) {
      console.error("Refresh session error:", error)
      throw error
    }
  }, [updateAuthState])

  const contextValue: AuthContextValue = {
    ...authState,
    signInWithOAuth,
    signOut,
    refreshSession
  }

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  )
}

/**
 * Hook to access the auth context
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth()
  return isAuthenticated
}

/**
 * Hook to get current user
 */
export function useUser() {
  const { user } = useAuth()
  return user
}

export { AuthContext }

