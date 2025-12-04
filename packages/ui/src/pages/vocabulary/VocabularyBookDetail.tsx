/**
 * Vocabulary Book Detail Page
 * Shows learning progress, statistics, and provides entry to learning session
 * Integrated with FSRS-based spaced repetition algorithm
 */

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Brain,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  PlayCircle,
  Sparkles,
  Target,
  AlertCircle,
  Settings,
  Upload,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend
} from "recharts"
import {
  cn,
  useNavigation,
  useTranslation,
  useBookDetail,
  formatWordForDisplay,
  useAuth,
  useVocabularyImport,
  type BookDetailStats,
  type ImportStatus
} from "@ace-ielts/core"

import { MainLayout } from "../../layout"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Progress,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  fadeInUp
} from "../../components"
import { BookSettingsDialog } from "./BookSettingsDialog"

/**
 * Progress ring component
 */
function ProgressRing({
  progress,
  size = 105,
  strokeWidth = 8,
  label,
  value
}: {
  progress: number
  size?: number
  strokeWidth?: number
  label: string
  value: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-neutral-border"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className="text-primary"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
          style={{
            strokeDasharray: circumference
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-text-primary">{value}</span>
        <span className="text-xs text-text-secondary">{label}</span>
      </div>
    </div>
  )
}

/**
 * Word list item component
 */
function WordListItem({
  word,
  index
}: {
  word: ReturnType<typeof formatWordForDisplay>
  index: number
}) {
  const masteryColors = {
    new: "bg-slate-100 text-slate-600",
    learning: "bg-amber-100 text-amber-700",
    mastered: "bg-emerald-100 text-emerald-700"
  }

  const masteryLabels = {
    new: "New",
    learning: "Learning",
    mastered: "Mastered"
  }

  return (
    <motion.div
      className="flex items-center justify-between py-2 border-b border-neutral-border last:border-0"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <div className="flex items-center gap-3">
        <span className="font-medium text-text-primary">{word.word}</span>
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium",
            masteryColors[word.mastery]
          )}
        >
          {masteryLabels[word.mastery]}
        </span>
      </div>
      {word.nextReview && (
        <span className="text-xs text-text-tertiary">Next: {word.nextReview}</span>
      )}
    </motion.div>
  )
}

function ForgettingCurveChart({
  masteredS = 30,
  learningS = 7,
  newS = 2,
  days = 30
}: {
  masteredS?: number
  learningS?: number
  newS?: number
  days?: number
}) {
  const { t } = useTranslation()

  // Calculate retention data points
  const retention = (d: number, S: number) => Math.exp(-d / S)
  const data = Array.from({ length: days + 1 }, (_, i) => ({
    day: i,
    mastered: retention(i, masteredS),
    learning: retention(i, learningS),
    new: retention(i, newS)
  }))

  // Custom tooltip formatter
  interface TooltipPayloadItem {
    dataKey: string
    value: number
    color: string
    payload: { day: number }
  }
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) => {
    if (!active || !payload || payload.length === 0) return null

    const day = payload[0].payload.day

    return (
      <div className="bg-white border border-neutral-border rounded-lg shadow-lg p-3 space-y-2">
        <p className="text-sm font-medium text-text-primary border-b pb-2">
          {t("vocabulary.bookDetail.tooltipDays", { days: day })}
        </p>
        {payload.map((entry) => {
          const labelMap: Record<string, string> = {
            mastered: t("vocabulary.bookDetail.tooltipMastered", { strength: masteredS }),
            learning: t("vocabulary.bookDetail.tooltipLearning", { strength: learningS }),
            new: t("vocabulary.bookDetail.tooltipNew", { strength: newS })
          }
          const colorMap: Record<string, string> = {
            mastered: "#059669",
            learning: "#d97706",
            new: "#475569"
          }
          return (
            <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: colorMap[entry.dataKey] || entry.color }}
              />
              <span className="text-text-secondary">{labelMap[entry.dataKey]}:</span>
              <span className="font-medium text-text-primary">
                {t("vocabulary.bookDetail.tooltipRetention", {
                  percent: (entry.value * 100).toFixed(1)
                })}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 15, left: 5, bottom: 20 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" />
          <XAxis
            dataKey="day"
            label={{
              value: t("vocabulary.bookDetail.xAxisLabel"),
              position: "insideBottom",
              offset: -3,
              style: { textAnchor: "middle", fill: "#6b7280", fontSize: 11 }
            }}
            stroke="#9ca3af"
            tick={{ fill: "#6b7280", fontSize: 11 }}
            domain={[0, days]}
          />
          <YAxis
            label={{
              value: t("vocabulary.bookDetail.yAxisLabel"),
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle", fill: "#6b7280", fontSize: 11 }
            }}
            stroke="#9ca3af"
            tick={{ fill: "#6b7280", fontSize: 11 }}
            domain={[0, 1]}
            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <RechartsTooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: "10px" }}
            iconType="line"
            formatter={(value) => {
              const labelMap: Record<string, string> = {
                mastered: t("vocabulary.bookDetail.mastered"),
                learning: t("vocabulary.bookDetail.learning"),
                new: t("vocabulary.bookDetail.new")
              }
              return labelMap[value] || value
            }}
          />
          <Line
            type="monotone"
            dataKey="mastered"
            stroke="#059669"
            strokeWidth={2}
            dot={false}
            name="mastered"
          />
          <Line
            type="monotone"
            dataKey="learning"
            stroke="#d97706"
            strokeWidth={2}
            dot={false}
            name="learning"
          />
          <Line
            type="monotone"
            dataKey="new"
            stroke="#475569"
            strokeWidth={2}
            dot={false}
            name="new"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Loading skeleton component
 */
function LoadingSkeleton() {
  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-lg animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-neutral-border rounded" />
        <div className="flex-1">
          <div className="h-7 w-48 bg-neutral-border rounded mb-2" />
          <div className="h-4 w-64 bg-neutral-border rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <div className="lg:col-span-2 h-64 bg-neutral-border rounded-xl" />
        <div className="h-64 bg-neutral-border rounded-xl" />
        <div className="lg:col-span-2 h-80 bg-neutral-border rounded-xl" />
        <div className="space-y-lg">
          <div className="h-48 bg-neutral-border rounded-xl" />
          <div className="h-48 bg-neutral-border rounded-xl" />
        </div>
      </div>
    </div>
  )
}

/**
 * Error state component
 */
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="max-w-6xl mx-auto flex flex-col items-center justify-center py-20 gap-4">
      <AlertCircle className="h-12 w-12 text-red-500" />
      <p className="text-text-secondary text-center">{message}</p>
      <Button onClick={onRetry} variant="outline">
        {t("vocabulary.retry")}
      </Button>
    </div>
  )
}

/**
 * Main VocabularyBookDetail page component
 */
export function VocabularyBookDetail() {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { user, isLoading: isAuthLoading } = useAuth()
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)

  // Extract bookId from URL - assuming route pattern /vocabulary/:bookId
  const bookId = useMemo(() => {
    const path = navigation.getCurrentPath()
    const match = path.match(/\/vocabulary\/([^/]+)/)
    return match ? match[1] : null
  }, [navigation])

  // Fetch book details
  const {
    book,
    stats,
    recentWords,
    difficultWords,
    todaySession,
    isLoading,
    error,
    refetch,
    initializeProgress
  } = useBookDetail(bookId, user?.id ?? null)

  // Check import status - use hook for real-time polling if importing or failed
  const importStatus = book?.import_status as ImportStatus | null
  const needsPolling = importStatus === "importing" || importStatus === "failed"
  
  const {
    progress: realTimeProgress,
    isImporting,
    isFailed
  } = useVocabularyImport(
    needsPolling ? bookId : null,
    user?.id ?? null
  )

  // Use real-time progress if available, otherwise fall back to book data
  const currentImportStatus = realTimeProgress?.status ?? importStatus
  const isCurrentlyImporting = isImporting || currentImportStatus === "importing"
  const isCurrentlyFailed = isFailed || currentImportStatus === "failed"
  const importProgress = realTimeProgress?.current ?? book?.import_progress ?? 0
  const importTotal = realTimeProgress?.total ?? book?.import_total ?? 0
  const importError = realTimeProgress?.error ?? book?.import_error ?? null

  // Block access if importing or failed
  const isBlocked = isCurrentlyImporting || isCurrentlyFailed

  // Redirect to vocabulary list if blocked (when book data is loaded)
  useEffect(() => {
    if (!isLoading && book && isBlocked) {
      // Small delay to show the blocking message
      const timer = setTimeout(() => {
        navigation.navigate("/vocabulary")
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isLoading, book, isBlocked, navigation])

  // Initialize progress when user starts viewing the book (only if not blocked)
  useEffect(() => {
    if (book && user && !isLoading && !isBlocked) {
      initializeProgress()
    }
  }, [book, user, isLoading, initializeProgress, isBlocked])

  // Calculate percentages
  const masteredPercent = useMemo(() => {
    if (!stats || stats.totalWords === 0) return 0
    return Math.round((stats.mastered / stats.totalWords) * 100)
  }, [stats])

  const learningPercent = useMemo(() => {
    if (!stats || stats.totalWords === 0) return 0
    return Math.round((stats.learning / stats.totalWords) * 100)
  }, [stats])

  const newPercent = useMemo(() => {
    if (!stats || stats.totalWords === 0) return 0
    return Math.round((stats.newWords / stats.totalWords) * 100)
  }, [stats])

  // Calculate estimated completion time
  const estimatedCompletionText = useMemo(() => {
    if (!stats) return ""
    const remainingWords = stats.newWords + stats.learning
    if (remainingWords === 0) return t("vocabulary.bookDetail.estimatedCompletionDays", { days: 0 })

    const dailyWords = (stats.todayNew + stats.todayReview) || 1
    const estimatedDays = Math.ceil(remainingWords / dailyWords)

    if (estimatedDays < 7) {
      return t("vocabulary.bookDetail.estimatedCompletionDays", { days: estimatedDays })
    } else if (estimatedDays < 30) {
      const weeks = Math.ceil(estimatedDays / 7)
      return t("vocabulary.bookDetail.estimatedCompletionWeeks", { weeks })
    } else {
      const months = Math.ceil(estimatedDays / 30)
      return t("vocabulary.bookDetail.estimatedCompletionMonths", { months })
    }
  }, [stats, t])

  // Format words for display
  const formattedRecentWords = useMemo(
    () => recentWords.map(formatWordForDisplay),
    [recentWords]
  )

  const formattedDifficultWords = useMemo(
    () => difficultWords.map(formatWordForDisplay),
    [difficultWords]
  )

  // Calculate average stability for chart
  const chartStability = useMemo(() => {
    if (!stats) return { mastered: 30, learning: 7, new: 2 }
    return {
      mastered: Math.max(21, stats.averageStability * 1.5),
      learning: Math.max(3, stats.averageStability * 0.5),
      new: 2
    }
  }, [stats])

  const handleBack = () => {
    navigation.navigate("/vocabulary")
  }

  const handleStartLearning = () => {
    if (bookId) {
      navigation.navigate(`/vocabulary/${bookId}/learn`)
    }
  }

  const handleNavigate = (itemId: string) => {
    navigation.navigate(`/${itemId}`)
  }

  const handleOpenSettings = () => {
    setSettingsDialogOpen(true)
  }

  const handleSettingsSuccess = () => {
    // Settings saved, could refresh if needed
  }

  // Loading state
  if (isLoading || isAuthLoading) {
    return (
      <MainLayout activeNav="vocabulary" onNavigate={handleNavigate}>
        <LoadingSkeleton />
      </MainLayout>
    )
  }

  // Error state
  if (error || !book) {
    return (
      <MainLayout activeNav="vocabulary" onNavigate={handleNavigate}>
        <ErrorState
          message={error || t("vocabulary.errors.fetchFailed")}
          onRetry={refetch}
        />
      </MainLayout>
    )
  }

  // Block access if importing or failed
  if (isBlocked) {
    const importPercent = importTotal > 0 ? Math.round((importProgress / importTotal) * 100) : 0
    return (
      <MainLayout activeNav="vocabulary" onNavigate={handleNavigate}>
        <motion.div
          className="max-w-2xl mx-auto flex flex-col items-center justify-center py-20 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {isCurrentlyImporting ? (
            <>
              <div className="relative">
                <Upload className="h-16 w-16 text-ai animate-spin" />
              </div>
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold text-text-primary">
                  {t("vocabulary.importing")}
                </h2>
                <p className="text-text-secondary">
                  {t("vocabulary.errors.importInProgress")}
                </p>
                <div className="w-full max-w-md space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">
                      {t("vocabulary.importProgress", { current: importProgress, total: importTotal })}
                    </span>
                    <span className="text-ai font-semibold">{importPercent}%</span>
                  </div>
                  <Progress value={importPercent} variant="ai" animated className="h-2" />
                </div>
                <p className="text-sm text-text-tertiary mt-4">
                  {t("vocabulary.importBlocked")}
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="h-16 w-16 text-red-500" />
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold text-text-primary">
                  {t("vocabulary.importFailed")}
                </h2>
                {importError && (
                  <p className="text-red-700 bg-red-50 border border-red-200 rounded-md p-3 text-sm">
                    {t("vocabulary.importError", { error: importError })}
                  </p>
                )}
                <p className="text-text-secondary">
                  {t("vocabulary.errors.importInProgress")}
                </p>
                <Button onClick={handleBack} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t("vocabulary.pageTitle")}
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </MainLayout>
    )
  }

  const displayStats: BookDetailStats = stats || {
    totalWords: book.word_count,
    mastered: 0,
    learning: 0,
    newWords: book.word_count,
    todayReview: 0,
    todayNew: Math.min(20, book.word_count),
    estimatedMinutes: Math.min(10, book.word_count),
    streak: 0,
    accuracy: 0,
    averageStability: 0
  }

  return (
    <MainLayout activeNav="vocabulary" onNavigate={handleNavigate}>
      <motion.div
        className="max-w-6xl mx-auto flex flex-col gap-lg"
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
      >
        {/* Back Button & Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-text-primary">{book.name}</h1>
              {user && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleOpenSettings}
                  className="h-8 w-8"
                  title={t("vocabulary.settings.title")}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-text-secondary text-sm">
              {book.description || t("vocabulary.noDescription")}
            </p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          {/* Row 1: Overview & Today's Goal - same height */}
          {/* Overview Card */}
          <Card className="lg:col-span-2 flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-primary" />
                {t("vocabulary.bookDetail.overview")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex flex-col sm:flex-row items-center gap-5">
                {/* Progress Ring */}
                <ProgressRing
                  progress={masteredPercent}
                  label={t("vocabulary.bookDetail.mastered")}
                  value={`${masteredPercent}%`}
                />

                {/* Stats Breakdown */}
                <div className="flex-1 grid grid-cols-3 gap-3 w-full">
                  <div className="text-center p-3 rounded-lg bg-emerald-50">
                    <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-600 mb-1.5" />
                    <p className="text-xl font-bold text-emerald-700">
                      {displayStats.mastered}
                    </p>
                    <p className="text-xs text-emerald-600">
                      {t("vocabulary.bookDetail.mastered")}
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-amber-50">
                    <BookOpen className="h-5 w-5 mx-auto text-amber-600 mb-1.5" />
                    <p className="text-xl font-bold text-amber-700">
                      {displayStats.learning}
                    </p>
                    <p className="text-xs text-amber-600">
                      {t("vocabulary.bookDetail.learning")}
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-slate-50">
                    <Sparkles className="h-5 w-5 mx-auto text-slate-600 mb-1.5" />
                    <p className="text-xl font-bold text-slate-700">
                      {displayStats.newWords}
                    </p>
                    <p className="text-xs text-slate-600">
                      {t("vocabulary.bookDetail.new")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-text-secondary">
                    {t("vocabulary.wordsCount", { count: displayStats.totalWords })}
                  </span>
                </div>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="h-2.5 bg-neutral-border rounded-full overflow-hidden flex">
                        <motion.div
                          className="bg-emerald-500 h-full"
                          initial={{ width: 0 }}
                          animate={{
                            width: `${(displayStats.mastered / displayStats.totalWords) * 100}%`
                          }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                        <motion.div
                          className="bg-amber-500 h-full"
                          initial={{ width: 0 }}
                          animate={{
                            width: `${(displayStats.learning / displayStats.totalWords) * 100}%`
                          }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                        />
                        <motion.div
                          className="bg-slate-400 h-full"
                          initial={{ width: 0 }}
                          animate={{
                            width: `${(displayStats.newWords / displayStats.totalWords) * 100}%`
                          }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>
                            {t("vocabulary.bookDetail.mastered")}: {masteredPercent}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-amber-600" />
                          <span>
                            {t("vocabulary.bookDetail.learning")}: {learningPercent}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-slate-600" />
                          <span>
                            {t("vocabulary.bookDetail.new")}: {newPercent}%
                          </span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Estimated Completion Time */}
              {displayStats.newWords + displayStats.learning > 0 && (
                <div className="mt-3 pt-3 border-t border-neutral-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-text-secondary" />
                      <span className="text-xs text-text-secondary">
                        {t("vocabulary.bookDetail.estimatedCompletion")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-primary">
                        {estimatedCompletionText}
                      </span>
                      <span className="text-xs text-text-tertiary">
                        {t("vocabulary.bookDetail.estimatedCompletionAtPace")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Today's Learning Plan Card - same row as Overview */}
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-primary" />
                {t("vocabulary.bookDetail.todayPlan")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                {/* Learning Content */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm text-text-secondary">
                        {t("vocabulary.bookDetail.wordsToReview", {
                          count: todaySession?.reviewWords.length || displayStats.todayReview
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-600" />
                      <span className="text-sm text-text-secondary">
                        {t("vocabulary.bookDetail.newWordsToday", {
                          count: todaySession?.newWords.length || displayStats.todayNew
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Estimated Time */}
                <div className="pt-2 border-t border-neutral-border">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-text-secondary" />
                    <span className="text-sm text-text-secondary">
                      {t("vocabulary.bookDetail.estimatedTime", {
                        minutes:
                          todaySession?.estimatedMinutes || displayStats.estimatedMinutes
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Start Learning Button */}
              <Button onClick={handleStartLearning} className="w-full mt-4 gap-2">
                <PlayCircle className="h-4 w-4" />
                {t("vocabulary.bookDetail.startSession")}
              </Button>
            </CardContent>
          </Card>

          {/* Row 2: Forgetting Curve Chart */}
          <Card className="lg:col-span-2 flex flex-col">
            <CardHeader className="pb-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                {t("vocabulary.bookDetail.forgettingCurve")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-4 flex-1 flex flex-col min-h-0">
              <div className="mb-2 text-xs text-text-secondary">
                {t("vocabulary.bookDetail.retentionProbability")}
              </div>
              <div className="flex-1 min-h-[280px]">
                <ForgettingCurveChart
                  masteredS={chartStability.mastered}
                  learningS={chartStability.learning}
                  newS={chartStability.new}
                  days={30}
                />
              </div>
              <div className="mt-2 text-xs text-text-tertiary">
                {t("vocabulary.bookDetail.fsrsHint")}
              </div>
            </CardContent>
          </Card>

          {/* Right Column - Stats & Words */}
          <div className="flex flex-col gap-lg">
            {/* Recent Words */}
            <Card className="flex-1 flex flex-col">
              <CardHeader className="pb-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  {t("vocabulary.bookDetail.recentWords")}
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 flex-1 flex flex-col justify-center">
                {formattedRecentWords.length > 0 ? (
                  <div>
                    {formattedRecentWords.map((word, index) => (
                      <WordListItem key={word.id} word={word} index={index} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-tertiary py-4 text-center">
                    {t("vocabulary.bookDetail.noRecentWords", {
                      defaultValue: "No words learned yet"
                    })}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Difficult Words */}
            <Card className="flex-1 flex flex-col">
              <CardHeader className="pb-1">
                <CardTitle className="text-base flex items-center gap-2 text-amber-600">
                  <Brain className="h-4 w-4" />
                  {t("vocabulary.bookDetail.difficult")}
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 flex-1 flex flex-col justify-center">
                {formattedDifficultWords.length > 0 ? (
                  <div>
                    {formattedDifficultWords.map((word, index) => (
                      <WordListItem key={word.id} word={word} index={index} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-tertiary py-4 text-center">
                    {t("vocabulary.bookDetail.noDifficultWords", {
                      defaultValue: "No difficult words yet"
                    })}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>

      {/* Book Settings Dialog */}
      {user && bookId && (
        <BookSettingsDialog
          open={settingsDialogOpen}
          onOpenChange={setSettingsDialogOpen}
          userId={user.id}
          bookId={bookId}
          onSuccess={handleSettingsSuccess}
        />
      )}
    </MainLayout>
  )
}

export default VocabularyBookDetail
