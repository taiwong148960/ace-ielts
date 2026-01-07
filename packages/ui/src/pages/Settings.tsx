/**
 * Settings Page
 * User settings including provider selection and model settings
 */

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Settings as SettingsIcon,
  Save,
  AlertCircle,
  CheckCircle2,
  Sparkles
} from "lucide-react"
import {
  useTranslation,
  useAuth,
  useUserSettings,
  useNavigation,
  createLogger,
  type GeminiTextModel,
  type GeminiTTSModel,
  DEFAULT_GEMINI_TEXT_MODEL_CONFIG,
  DEFAULT_GEMINI_TTS_MODEL_CONFIG,
  type GeminiModelConfig
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  fadeInUp
} from "../components"

export function Settings() {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { user } = useAuth()
  const logger = createLogger("Settings")
  const {
    settings,
    isLoading,
    updateSettings,
    isUpdating,
    updateError
  } = useUserSettings(user?.id ?? null)

  const [saveSuccess, setSaveSuccess] = useState(false)

  // Gemini model configuration state
  const [textModel, setTextModel] = useState<GeminiTextModel>(
    DEFAULT_GEMINI_TEXT_MODEL_CONFIG.model
  )
  const [temperature, setTemperature] = useState(
    DEFAULT_GEMINI_TEXT_MODEL_CONFIG.temperature || 0.7
  )
  const [topK, setTopK] = useState(DEFAULT_GEMINI_TEXT_MODEL_CONFIG.topK || 40)
  const [topP, setTopP] = useState(DEFAULT_GEMINI_TEXT_MODEL_CONFIG.topP || 0.95)
  const [maxOutputTokens, setMaxOutputTokens] = useState(
    DEFAULT_GEMINI_TEXT_MODEL_CONFIG.maxOutputTokens || 2048
  )
  const [ttsModel, setTtsModel] = useState<GeminiTTSModel>(
    DEFAULT_GEMINI_TTS_MODEL_CONFIG.model
  )

  // Load stored settings into form fields
  useEffect(() => {
    if (settings && !isLoading && settings.gemini_model_config) {
      const config = settings.gemini_model_config
      // Full configuration is required, merge with defaults for backward compatibility
      const textModelConfig = {
        ...DEFAULT_GEMINI_TEXT_MODEL_CONFIG,
        ...config.textModel
      }
      const ttsModelConfig = {
        ...DEFAULT_GEMINI_TTS_MODEL_CONFIG,
        ...config.ttsModel
      }
      
      setTextModel(textModelConfig.model)
      setTemperature(textModelConfig.temperature ?? 0.7)
      setTopK(textModelConfig.topK ?? 40)
      setTopP(textModelConfig.topP ?? 0.95)
      setMaxOutputTokens(textModelConfig.maxOutputTokens ?? 2048)
      setTtsModel(ttsModelConfig.model)
    }
  }, [settings, isLoading])

  const handleNavigate = (itemId: string) => {
    if (itemId === "settings") {
      navigation.navigate("/settings")
    } else if (itemId === "dashboard") {
      navigation.navigate("/dashboard")
    } else if (itemId === "vocabulary") {
      navigation.navigate("/vocabulary")
    } else if (itemId === "profile") {
      navigation.navigate("/profile")
    } else {
      navigation.navigate(`/${itemId}`)
    }
  }

  const handleSave = async () => {
    try {
      // Build complete Gemini model configuration (all fields required)
      const geminiConfig: GeminiModelConfig = {
        textModel: {
          model: textModel,
          temperature,
          topK,
          topP,
          maxOutputTokens
        },
        ttsModel: {
          model: ttsModel
        }
      }

      // Always send full configuration
      await updateSettings({
        llm_provider: "gemini",
        gemini_model_config: geminiConfig
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      logger.error("Error saving settings", { userId: user?.id }, error instanceof Error ? error : new Error(String(error)))
    }
  }

  if (isLoading) {
    return (
      <MainLayout activeNav="settings" onNavigate={handleNavigate}>
        <motion.div
          className="max-w-4xl mx-auto flex items-center justify-center min-h-[400px]"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </motion.div>
      </MainLayout>
    )
  }

  return (
    <MainLayout activeNav="settings" onNavigate={handleNavigate}>
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

        {/* Gemini Model Configuration */}
        <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-ai" />
                {t("settings.geminiConfig.title")}
              </CardTitle>
              <CardDescription>
                {t("settings.geminiConfig.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Text Model Configuration */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  {t("settings.geminiConfig.textModel.title")}
                </h3>

                {/* Model Selection */}
                <div className="space-y-2">
                  <Label htmlFor="text-model">
                    {t("settings.geminiConfig.textModel.modelLabel")}
                  </Label>
                  <Select
                    value={textModel}
                    onValueChange={(value: GeminiTextModel) => setTextModel(value)}
                  >
                    <SelectTrigger id="text-model" disabled={isUpdating}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-3-flash-preview">Gemini 3 Flash</SelectItem>
                      <SelectItem value="gemini-3-pro-preview">Gemini 3 Pro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Temperature */}
                <div className="space-y-2">
                  <Label htmlFor="temperature">
                    {t("settings.geminiConfig.textModel.temperature")} ({temperature.toFixed(1)})
                  </Label>
                  <Input
                    id="temperature"
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(Math.max(0, Math.min(2, parseFloat(e.target.value) || 0)))}
                    disabled={isUpdating}
                  />
                  <p className="text-xs text-text-tertiary">
                    {t("settings.geminiConfig.textModel.temperatureHint")}
                  </p>
                </div>

                {/* Top K */}
                <div className="space-y-2">
                  <Label htmlFor="topk">
                    {t("settings.geminiConfig.textModel.topK")} ({topK})
                  </Label>
                  <Input
                    id="topk"
                    type="number"
                    min="1"
                    max="40"
                    step="1"
                    value={topK}
                    onChange={(e) => setTopK(Math.max(1, Math.min(40, parseInt(e.target.value) || 1)))}
                    disabled={isUpdating}
                  />
                  <p className="text-xs text-text-tertiary">
                    {t("settings.geminiConfig.textModel.topKHint")}
                  </p>
                </div>

                {/* Top P */}
                <div className="space-y-2">
                  <Label htmlFor="topp">
                    {t("settings.geminiConfig.textModel.topP")} ({topP.toFixed(2)})
                  </Label>
                  <Input
                    id="topp"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={topP}
                    onChange={(e) => setTopP(Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)))}
                    disabled={isUpdating}
                  />
                  <p className="text-xs text-text-tertiary">
                    {t("settings.geminiConfig.textModel.topPHint")}
                  </p>
                </div>

                {/* Max Output Tokens */}
                <div className="space-y-2">
                  <Label htmlFor="max-tokens">
                    {t("settings.geminiConfig.textModel.maxTokens")} ({maxOutputTokens})
                  </Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    min="1"
                    max="8192"
                    step="1"
                    value={maxOutputTokens}
                    onChange={(e) => setMaxOutputTokens(Math.max(1, Math.min(8192, parseInt(e.target.value) || 1)))}
                    disabled={isUpdating}
                  />
                  <p className="text-xs text-text-tertiary">
                    {t("settings.geminiConfig.textModel.maxTokensHint")}
                  </p>
                </div>
              </div>

              {/* TTS Model Configuration */}
              <div className="space-y-4 border-t border-neutral-border pt-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  {t("settings.geminiConfig.ttsModel.title")}
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="tts-model">
                    {t("settings.geminiConfig.ttsModel.modelLabel")}
                  </Label>
                  <Select
                    value={ttsModel}
                    onValueChange={(value: GeminiTTSModel) => setTtsModel(value)}
                  >
                    <SelectTrigger id="tts-model" disabled={isUpdating}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-2.5-flash-preview-tts">Gemini 2.5 Flash TTS</SelectItem>
                      <SelectItem value="gemini-2.5-pro-preview-tts">Gemini 2.5 Pro TTS</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-text-tertiary">
                    {t("settings.geminiConfig.ttsModel.hint")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

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
              {t("settings.saved")}
            </span>
          </div>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isUpdating || isLoading}
          className="gap-2 self-start"
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
      </motion.div>
    </MainLayout>
  )
}

export default Settings
