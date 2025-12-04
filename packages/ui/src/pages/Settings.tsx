/**
 * Settings Page
 * User settings including LLM API key configuration (self-hosted mode only)
 */

import { useState } from "react"
import { motion } from "framer-motion"
import { Settings as SettingsIcon, Key, Save, AlertCircle, CheckCircle2 } from "lucide-react"
import {
  useTranslation,
  useAuth,
  useUserSettings,
  isSelfHostedMode
} from "@ace-ielts/core"

import { MainLayout } from "../layout"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
  fadeInUp
} from "../components"

export function Settings() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { isLoading, hasApiKey, updateSettings, isUpdating, updateError } = useUserSettings(user?.id ?? null)

  const [apiKey, setApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const isSelfHosted = isSelfHostedMode()

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      return
    }

    try {
      await updateSettings({ llm_api_key: apiKey.trim() })
      setApiKey("")
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error("Error saving API key:", error)
    }
  }

  // Don't show settings in SaaS mode
  if (!isSelfHosted) {
    return (
      <MainLayout activeNav="settings" onNavigate={() => {}}>
        <motion.div
          className="max-w-4xl mx-auto"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <SettingsIcon className="h-16 w-16 mx-auto text-text-tertiary mb-4" />
                <p className="text-text-secondary">
                  {t("settings.notAvailableInSaaS")}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </MainLayout>
    )
  }

  return (
    <MainLayout activeNav="settings" onNavigate={() => {}}>
      <motion.div
        className="max-w-4xl mx-auto flex flex-col gap-lg"
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
      >
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-primary" />
            {t("settings.title")}
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            {t("settings.description")}
          </p>
        </div>

        {/* LLM API Key Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              {t("settings.llmApiKey.title")}
            </CardTitle>
            <CardDescription>
              {t("settings.llmApiKey.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Status */}
            {hasApiKey && (
              <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-md">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm text-success">
                  {t("settings.llmApiKey.configured")}
                </span>
              </div>
            )}

            {/* API Key Input */}
            <div className="space-y-2">
              <Label htmlFor="api-key">
                {t("settings.llmApiKey.label")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={t("settings.llmApiKey.placeholder")}
                  disabled={isUpdating || isLoading}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                  disabled={isUpdating || isLoading}
                >
                  {showApiKey ? t("settings.llmApiKey.hide") : t("settings.llmApiKey.show")}
                </Button>
              </div>
              <p className="text-xs text-text-tertiary">
                {t("settings.llmApiKey.hint")}
              </p>
            </div>

            {/* Error Message */}
            {updateError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-700">
                  {updateError instanceof Error ? updateError.message : t("settings.errors.saveFailed")}
                </span>
              </div>
            )}

            {/* Success Message */}
            {saveSuccess && (
              <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-md">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm text-success">
                  {t("settings.llmApiKey.saved")}
                </span>
              </div>
            )}

            {/* Save Button */}
            <Button
              onClick={handleSaveApiKey}
              disabled={!apiKey.trim() || isUpdating || isLoading}
              className="gap-2"
            >
              {isUpdating ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t("settings.saving")}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {t("settings.save")}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </MainLayout>
  )
}

export default Settings

