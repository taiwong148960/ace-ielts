/**
 * Book Settings Dialog
 * Modal dialog for configuring vocabulary book learning settings
 */

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Settings, Loader2, AlertCircle, X } from "lucide-react"
import {
  useTranslation,
  useBookSettings,
  createLogger,
  type StudyOrder,
  type LearningMode
} from "@ace-ielts/core"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  ToggleGroup,
  ToggleGroupItem
} from "../../components"

interface BookSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  bookId: string
  onSuccess?: () => void
}

export function BookSettingsDialog({
  open,
  onOpenChange,
  userId,
  bookId,
  onSuccess
}: BookSettingsDialogProps) {
  const { t } = useTranslation()
  const logger = createLogger("BookSettingsDialog")

  // Use TanStack Query hook for fetching and updating settings
  const {
    settings,
    isLoading,
    error: fetchError,
    updateSettings,
    isUpdating
  } = useBookSettings({
    userId,
    bookId,
    enabled: open
  })

  // Form state (local until submitted)
  const [dailyNewLimit, setDailyNewLimit] = useState(20)
  const [dailyReviewLimit, setDailyReviewLimit] = useState(60)
  const [learningMode, setLearningMode] = useState<LearningMode>("read_only")
  const [studyOrder, setStudyOrder] = useState<StudyOrder>("sequential")
  const [error, setError] = useState<string | null>(null)

  // Sync form state with fetched settings
  useEffect(() => {
    if (settings) {
      setDailyNewLimit(settings.daily_new_limit)
      setDailyReviewLimit(settings.daily_review_limit)
      setLearningMode(settings.learning_mode)
      setStudyOrder(settings.study_order)
    }
  }, [settings])

  // Auto-update review limit when new limit changes (3x multiplier)
  const handleNewLimitChange = (value: string) => {
    const numValue = parseInt(value, 10)
    if (!isNaN(numValue) && numValue > 0) {
      setDailyNewLimit(numValue)
      // Auto-update review limit to 3x if user hasn't manually changed it
      const currentReviewLimit = parseInt(String(dailyReviewLimit), 10)
      const expectedReviewLimit = numValue * 3
      if (currentReviewLimit === (dailyNewLimit * 3)) {
        setDailyReviewLimit(expectedReviewLimit)
      }
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (dailyNewLimit < 5 || dailyNewLimit > 200) {
      setError(t("vocabulary.settings.errors.invalidNewLimit"))
      return
    }

    if (dailyReviewLimit < 1 || dailyReviewLimit > 1000) {
      setError(t("vocabulary.settings.errors.invalidReviewLimit"))
      return
    }

    try {
      await updateSettings({
        daily_new_limit: dailyNewLimit,
        daily_review_limit: dailyReviewLimit,
        learning_mode: learningMode,
        study_order: studyOrder
      })

      // Close dialog and notify parent
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      logger.error("Error saving settings", { userId, bookId }, err instanceof Error ? err : new Error(String(err)))
      setError(t("vocabulary.settings.errors.saveFailed"))
    }
  }

  // Reset form when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setError(null)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            {t("vocabulary.settings.title")}
          </DialogTitle>
          <DialogDescription>
            {t("vocabulary.settings.description")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 flex-1">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : fetchError ? (
          <div className="flex items-center justify-center py-12 flex-1">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-600">{t("vocabulary.settings.errors.loadFailed")}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 space-y-6 mt-4 pr-2 -mr-2">
            {/* Daily Limits */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">
                {t("vocabulary.settings.dailyLimits")}
              </h3>

              {/* New Words Limit */}
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <Label htmlFor="daily-new-limit" required className="min-w-[140px]">
                    {t("vocabulary.settings.dailyNewLimit")}
                  </Label>
                  <Input
                    id="daily-new-limit"
                    type="number"
                    min="5"
                    max="200"
                    value={dailyNewLimit}
                    onChange={(e) => handleNewLimitChange(e.target.value)}
                    disabled={isUpdating}
                    className="flex-1"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="min-w-[140px]"></div>
                  <p className="text-xs text-text-tertiary flex-1">
                    {t("vocabulary.settings.dailyNewLimitHint")}
                  </p>
                </div>
              </div>

              {/* Review Words Limit */}
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <Label htmlFor="daily-review-limit" required className="min-w-[140px]">
                    {t("vocabulary.settings.dailyReviewLimit")}
                  </Label>
                  <Input
                    id="daily-review-limit"
                    type="number"
                    min="1"
                    max="1000"
                    value={dailyReviewLimit}
                    onChange={(e) => {
                      const numValue = parseInt(e.target.value, 10)
                      if (!isNaN(numValue) && numValue > 0) {
                        setDailyReviewLimit(numValue)
                      }
                    }}
                    disabled={isUpdating}
                    className="flex-1"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="min-w-[140px]"></div>
                  <p className="text-xs text-text-tertiary flex-1">
                    {t("vocabulary.settings.dailyReviewLimitHint")}
                  </p>
                </div>
              </div>
            </div>

            {/* Learning Mode */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">
                {t("vocabulary.settings.learningMode")}
              </h3>

              <ToggleGroup
                type="single"
                value={learningMode}
                onValueChange={(value) => {
                  if (value) setLearningMode(value as LearningMode)
                }}
                disabled={isUpdating}
                className="w-full"
              >
                <ToggleGroupItem value="read_only" aria-label="Read Only">
                  {t("vocabulary.settings.readOnly")}
                </ToggleGroupItem>
                <ToggleGroupItem value="spelling" aria-label="Spelling">
                  {t("vocabulary.settings.spelling")}
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-xs text-text-tertiary">
                {learningMode === "read_only" 
                  ? t("vocabulary.settings.readOnlyHint")
                  : t("vocabulary.settings.spellingHint")}
              </p>
            </div>

            {/* Study Order */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">
                {t("vocabulary.settings.studyOrder")}
              </h3>

              <ToggleGroup
                type="single"
                value={studyOrder}
                onValueChange={(value) => {
                  if (value) setStudyOrder(value as StudyOrder)
                }}
                disabled={isUpdating}
                className="w-full"
              >
                <ToggleGroupItem value="sequential" aria-label="Sequential">
                  {t("vocabulary.settings.sequential")}
                </ToggleGroupItem>
                <ToggleGroupItem value="random" aria-label="Random">
                  {t("vocabulary.settings.random")}
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-xs text-text-tertiary">
                {t("vocabulary.settings.studyOrderHint")}
              </p>
            </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm"
                  >
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                    <button
                      type="button"
                      onClick={() => setError(null)}
                      className="ml-auto hover:bg-red-100 rounded p-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <DialogFooter className="gap-2 pt-4 mt-4 border-t border-neutral-border flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isUpdating}
              >
                {t("vocabulary.settings.cancel")}
              </Button>
              <Button type="submit" disabled={isUpdating} className="gap-2">
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("vocabulary.settings.saving")}
                  </>
                ) : (
                  t("vocabulary.settings.save")
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default BookSettingsDialog
