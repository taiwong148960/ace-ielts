/**
 * Login Page
 * OAuth login with GitHub and Google
 */

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { motion } from "framer-motion"
import { Github, Loader2 } from "lucide-react"
import { useAuth, useNavigation, type OAuthProvider } from "@ace-ielts/core"
import { Button } from "../components/button"
import { Card, CardContent, CardHeader } from "../components/card"

/**
 * Google icon component
 */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

/**
 * Login page component
 */
export function Login() {
  const { t } = useTranslation()
  const { signInWithOAuth, isLoading: authLoading, isAuthenticated } = useAuth()
  const navigation = useNavigation()
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigation.navigate("/dashboard")
    }
  }, [isAuthenticated, authLoading, navigation])

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    try {
      setError(null)
      setLoadingProvider(provider)
      await signInWithOAuth(provider)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("auth.error.loginFailed")
      )
      setLoadingProvider(null)
    }
  }

  const isLoading = authLoading || loadingProvider !== null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-teal-50/30 to-emerald-50/50 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-[#0E7569]/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-[#0E7569]/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-[#0E7569]/5 to-transparent rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="border-0 shadow-xl shadow-slate-200/50 backdrop-blur-sm bg-white/80">
          <CardHeader className="space-y-4 pb-2 pt-8 px-8">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0E7569] to-[#0B5C52] flex items-center justify-center shadow-lg shadow-[#0E7569]/25">
                <span className="text-white font-bold text-2xl font-serif">
                  A
                </span>
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-800 font-sans">
                  {t("common.appName")}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {t("common.tagline")}
                </p>
              </div>
            </motion.div>
          </CardHeader>

          <CardContent className="px-8 pb-8 pt-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="space-y-4"
            >
              {/* Title */}
              <div className="text-center mb-6">
                <h2 className="text-lg font-semibold text-gray-700">
                  {t("auth.welcomeBack")}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {t("auth.signInToContinue")}
                </p>
              </div>

              {/* Error message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm text-center"
                >
                  {error}
                </motion.div>
              )}

              {/* OAuth buttons */}
              <div className="space-y-3">
                {/* Google login */}
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-12 text-base font-medium border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                  onClick={() => handleOAuthLogin("google")}
                  disabled={isLoading}
                >
                  {loadingProvider === "google" ? (
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  ) : (
                    <GoogleIcon className="w-5 h-5 mr-3" />
                  )}
                  {t("auth.continueWithGoogle")}
                </Button>

                {/* GitHub login */}
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-12 text-base font-medium border-gray-200 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all duration-200"
                  onClick={() => handleOAuthLogin("github")}
                  disabled={isLoading}
                >
                  {loadingProvider === "github" ? (
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  ) : (
                    <Github className="w-5 h-5 mr-3" />
                  )}
                  {t("auth.continueWithGithub")}
                </Button>
              </div>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-400">
                    {t("auth.secureLogin")}
                  </span>
                </div>
              </div>

              {/* Terms */}
              <p className="text-xs text-gray-400 text-center leading-relaxed">
                {t("auth.termsAgreement")}{" "}
                <a
                  href="/terms"
                  className="text-[#0E7569] hover:underline"
                >
                  {t("auth.termsOfService")}
                </a>{" "}
                {t("auth.and")}{" "}
                <a
                  href="/privacy"
                  className="text-[#0E7569] hover:underline"
                >
                  {t("auth.privacyPolicy")}
                </a>
              </p>
            </motion.div>
          </CardContent>
        </Card>

        {/* Back to home */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="text-center mt-6"
        >
          <a
            href="/"
            className="text-sm text-gray-500 hover:text-[#0E7569] transition-colors"
          >
            ← {t("auth.backToHome")}
          </a>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default Login

