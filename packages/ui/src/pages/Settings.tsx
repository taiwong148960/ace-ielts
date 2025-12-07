/**
 * Settings Page
 * User settings including LLM API key configuration, provider selection, and model settings (self-hosted mode only)
 */

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Settings as SettingsIcon,
  Key,
  Save,
  AlertCircle,
  CheckCircle2,
  Brain,
  Sparkles
} from "lucide-react"
import {
  useTranslation,
  useAuth,
  useUserSettings,
  useNavigation,
  isSelfHostedMode,
  type LLMProvider,
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
  const {
    settings,
    isLoading,
    apiKey: storedApiKey,
    updateSettings,
    isUpdating,
    updateError
  } = useUserSettings(user?.id ?? null)

  const [apiKey, setApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [llmProvider, setLlmProvider] = useState<LLMProvider>("gemini")

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

  const isSelfHosted = isSelfHostedMode()

  // Load stored settings into form fields
  useEffect(() => {
    if (settings && !isLoading) {
      // Load API key (will be loaded separately by hook)
      if (storedApiKey !== undefined) {
        setApiKey(storedApiKey || "")
      }

      // Load LLM provider
      if (settings.llm_provider) {
        setLlmProvider(settings.llm_provider)
      }

      // Load Gemini model configuration
      if (settings.gemini_model_config) {
        const config = settings.gemini_model_config
        if (config.textModel?.model) {
          setTextModel(config.textModel.model)
        }
        if (config.textModel?.temperature !== undefined) {
          setTemperature(config.textModel.temperature)
        }
        if (config.textModel?.topK !== undefined) {
          setTopK(config.textModel.topK)
        }
        if (config.textModel?.topP !== undefined) {
          setTopP(config.textModel.topP)
        }
        if (config.textModel?.maxOutputTokens !== undefined) {
          setMaxOutputTokens(config.textModel.maxOutputTokens)
        }
        if (config.ttsModel?.model) {
          setTtsModel(config.ttsModel.model)
        }
      }
    }
  }, [settings, storedApiKey, isLoading])

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

      await updateSettings({
        llm_api_key: apiKey.trim() || undefined,
        llm_provider: llmProvider,
        gemini_model_config: geminiConfig
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error("Error saving settings:", error)
    }
  }

  // Don't show settings in SaaS mode
  if (!isSelfHosted) {
    return (
      <MainLayout activeNav="settings" onNavigate={handleNavigate}>
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

        {/* LLM Provider Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              {t("settings.llmProvider.title")}
            </CardTitle>
            <CardDescription>
              {t("settings.llmProvider.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="llm-provider">
                {t("settings.llmProvider.label")}
              </Label>
              <Select value={llmProvider} onValueChange={(value: LLMProvider) => setLlmProvider(value)}>
                <SelectTrigger id="llm-provider" disabled={isUpdating}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Gemini</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="azure-openai">Azure OpenAI</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-text-tertiary">
                {t("settings.llmProvider.hint")}
              </p>
            </div>
          </CardContent>
        </Card>

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
          </CardContent>
        </Card>

        {/* Gemini Model Configuration */}
        {llmProvider === "gemini" && (
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
                      <SelectItem value="gemini-3-pro-preview">Gemini 3 Pro Preview</SelectItem>
                      <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                      <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                      <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</SelectItem>
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
                      <SelectItem value="gemini-2.5-pro-preview-tts">Gemini 2.5 Pro Preview TTS</SelectItem>
                      <SelectItem value="gemini-2.5-flash-preview-tts">Gemini 2.5 Flash Preview TTS</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-text-tertiary">
                    {t("settings.geminiConfig.ttsModel.hint")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
