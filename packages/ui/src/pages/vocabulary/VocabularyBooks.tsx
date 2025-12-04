/**
 * Vocabulary Books Page
 * Displays all vocabulary books (user's and system) with search and navigation
 */

import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import {
  BookOpen,
  Plus,
  Search,
  ChevronRight,
  Clock,
  Sparkles,
  RefreshCw,
  Settings,
  AlertCircle,
  RotateCw,
  Loader2
} from "lucide-react"
import {
  cn,
  useNavigation,
  useTranslation,
  useAuth,
  useVocabularyBooks,
  useVocabularyImport,
  type VocabularyBookWithProgress,
  type ImportStatus
} from "@ace-ielts/core"

import { MainLayout } from "../../layout"
import {
  Card,
  CardContent,
  Button,
  Progress,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  fadeInUp,
  staggerContainer,
  staggerItem
} from "../../components"
import { CreateBookDialog } from "./CreateBookDialog"
import { BookSettingsDialog } from "./BookSettingsDialog"

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format last studied time
 */
function formatLastStudied(date: string | null | undefined): string | null {
  if (!date) return null

  const now = new Date()
  const studied = new Date(date)
  const diffMs = now.getTime() - studied.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return studied.toLocaleDateString()
}

// ============================================================================
// Import Status Component
// ============================================================================

interface ImportStatusDisplayProps {
  status: ImportStatus
  progress: number
  total: number
  error: string | null
  isRetrying: boolean
  onRetry: () => void
}

/**
 * Import status display component
 * Handles pending, importing, and failed states with detailed tooltip information
 */
function ImportStatusDisplay({
  status,
  progress,
  total,
  error,
  isRetrying,
  onRetry
}: ImportStatusDisplayProps) {
  const { t } = useTranslation()
  const percent = total > 0 ? Math.round((progress / total) * 100) : 0
  const failedCount = total - progress

  // Pending state - preparing to import
  if (status === "pending") {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="mb-3 p-3 bg-gradient-to-r from-ai-50 to-primary-50 border border-ai-200/60 rounded-lg cursor-help">
              {/* Header with spinning icon */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Loader2 className="h-4 w-4 text-ai animate-spin" />
                </div>
                <span className="text-sm font-semibold text-ai">
                  {t("vocabulary.import.pending")}
                </span>
              </div>

              {/* Indeterminate progress bar */}
              <div className="mt-2 h-2 bg-neutral-border/50 rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-gradient-to-r from-primary via-ai to-ai-light rounded-full animate-pulse" 
                  style={{ animation: 'shimmer 1.5s ease-in-out infinite' }}
                />
              </div>

              {/* Status text */}
              <p className="text-xs text-ai/80 mt-2 font-medium">
                {t("vocabulary.import.pendingText")}
              </p>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-2 p-1">
              <p className="font-semibold text-sm">
                {t("vocabulary.import.tooltipPending")}
              </p>
              <p className="text-xs text-text-secondary">
                {t("vocabulary.import.tooltipPendingDesc")}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (status === "importing") {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="mb-3 p-3 bg-gradient-to-r from-ai-50 to-primary-50 border border-ai-200/60 rounded-lg cursor-help">
              {/* Header with spinning icon and percentage */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Loader2 className="h-4 w-4 text-ai animate-spin" />
                    <div className="absolute inset-0 animate-ping opacity-30">
                      <Loader2 className="h-4 w-4 text-ai" />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-ai">
                    {t("vocabulary.import.importing")}
                  </span>
                </div>
                <span className="text-sm font-bold text-ai tabular-nums">
                  {percent}%
                </span>
              </div>

              {/* Progress bar */}
              <Progress 
                value={percent} 
                variant="ai" 
                size="sm" 
                animated 
                glow
                className="h-2" 
              />

              {/* Progress text */}
              <p className="text-xs text-ai/80 mt-2 font-medium">
                {t("vocabulary.import.progressText", { current: progress, total })}
              </p>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-2 p-1">
              <p className="font-semibold text-sm">
                {t("vocabulary.import.tooltipImporting")}
              </p>
              <div className="space-y-1 text-xs text-text-secondary">
                <p>{t("vocabulary.import.tooltipTotal", { total })}</p>
                <p>{t("vocabulary.import.tooltipCompleted", { completed: progress })}</p>
                <p>{t("vocabulary.import.tooltipRemaining", { remaining: total - progress })}</p>
              </div>
              <p className="text-xs text-text-tertiary italic pt-1 border-t border-neutral-border">
                {t("vocabulary.import.tooltipWait")}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (status === "failed") {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="mb-3 p-3 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200/60 rounded-lg cursor-help">
              {/* Header with error icon and retry button */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-700">
                    {t("vocabulary.import.failed")}
                  </span>
                </div>
                {isRetrying ? (
                  <div className="flex items-center gap-1.5 text-red-600">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-xs font-medium">
                      {t("vocabulary.import.retrying")}
                    </span>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2.5 text-xs font-medium text-red-700 hover:text-red-800 hover:bg-red-100/80 gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRetry()
                    }}
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    {t("vocabulary.import.retry")}
                  </Button>
                )}
              </div>

              {/* Progress bar showing what was completed */}
              {progress > 0 && (
                <Progress 
                  value={percent} 
                  indicatorColor="#EF4444"
                  size="sm" 
                  className="h-2" 
                />
              )}

              {/* Status text */}
              <p className="text-xs text-red-700/80 mt-2 font-medium">
                {failedCount > 0 
                  ? t("vocabulary.import.failedPartial", { completed: progress, failed: failedCount, total })
                  : t("vocabulary.import.failedAll", { total })
                }
              </p>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-2 p-1">
              <p className="font-semibold text-sm text-red-700">
                {t("vocabulary.import.tooltipFailed")}
              </p>
              {error && (
                <div className="bg-red-100 border border-red-200 rounded p-2 text-xs text-red-800">
                  {error}
                </div>
              )}
              <div className="space-y-1 text-xs text-text-secondary">
                <p>{t("vocabulary.import.tooltipTotal", { total })}</p>
                <p className="text-emerald-700">{t("vocabulary.import.tooltipSucceeded", { succeeded: progress })}</p>
                <p className="text-red-700">{t("vocabulary.import.tooltipFailedCount", { failed: failedCount })}</p>
              </div>
              <p className="text-xs text-text-tertiary italic pt-1 border-t border-neutral-border">
                {t("vocabulary.import.tooltipRetryHint")}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return null
}

// ============================================================================
// Book Card Component
// ============================================================================

interface VocabularyBookCardProps {
  book: VocabularyBookWithProgress
  onClick: () => void
  index: number
  isAuthenticated: boolean
  onOpenSettings?: (bookId: string, e: React.MouseEvent) => void
  userId?: string | null
}

/**
 * Single vocabulary book card component
 */
function VocabularyBookCard({
  book,
  onClick,
  index,
  isAuthenticated,
  onOpenSettings,
  userId
}: VocabularyBookCardProps) {
  const { t } = useTranslation()

  // Calculate mastery progress
  const masteredCount = book.progress?.mastered_count ?? 0
  const progressPercent =
    book.word_count > 0
      ? Math.round((masteredCount / book.word_count) * 100)
      : 0
  const lastStudied = formatLastStudied(book.progress?.last_studied_at)
  
  // Import status - use hook for real-time polling if pending, importing, or failed
  const importStatus = book.import_status as ImportStatus | null
  const needsPolling = importStatus === "pending" || importStatus === "importing" || importStatus === "failed"
  
  const {
    progress: realTimeProgress,
    isImporting,
    isFailed,
    isPending,
    retryFailed,
    isRetrying
  } = useVocabularyImport(
    needsPolling ? book.id : null,
    userId ?? null
  )

  // Use real-time progress if available, otherwise fall back to book data
  const importProgress = realTimeProgress?.current ?? book.import_progress ?? 0
  const importTotal = realTimeProgress?.total ?? book.import_total ?? 0
  const currentImportStatus = realTimeProgress?.status ?? importStatus
  const importError = realTimeProgress?.error ?? book.import_error ?? null
  
  // Determine current state (pending is treated like importing - will transition soon)
  const isCurrentlyPending = isPending || currentImportStatus === "pending"
  const isCurrentlyImporting = isImporting || currentImportStatus === "importing" || isCurrentlyPending
  const isCurrentlyFailed = isFailed || currentImportStatus === "failed"
  const isBlocked = isCurrentlyImporting || isCurrentlyFailed

  const handleCardClick = () => {
    if (isBlocked) return
    onClick()
  }

  return (
    <motion.div
      variants={staggerItem}
      initial="hidden"
      animate="visible"
      custom={index}
    >
      <Card
        className={cn(
          "group transition-all duration-300 overflow-hidden relative",
          isCurrentlyImporting 
            ? "cursor-not-allowed ring-2 ring-ai/30 shadow-glow-ai/10" 
            : isCurrentlyFailed
            ? "cursor-not-allowed ring-2 ring-red-300/50"
            : "cursor-pointer hover:shadow-lg hover:scale-[1.02]"
        )}
        onClick={handleCardClick}
      >
        {/* Overlay to prevent clicks when importing (not when failed - need to allow retry) */}
        {isCurrentlyImporting && (
          <div className="absolute inset-0 z-10 cursor-not-allowed" />
        )}

        {/* Book Cover */}
        <div className={cn("h-24 relative", book.cover_color)}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute inset-0 flex items-center justify-center px-3">
            <span className="text-white/90 font-semibold text-base sm:text-lg md:text-xl truncate">
              {book.cover_text || book.name}
            </span>
          </div>
          {/* Decorative circles */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-2 right-2 w-16 h-16 border border-white/30 rounded-full" />
            <div className="absolute bottom-2 left-2 w-8 h-8 border border-white/30 rounded-full" />
          </div>

          {/* Import indicator badge on cover (only show when importing, not failed) */}
          {isCurrentlyImporting && (
            <div className="absolute top-2 left-2 bg-ai/90 backdrop-blur-sm text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("vocabulary.import.badge")}
            </div>
          )}

          {/* Settings Button */}
          {isAuthenticated && onOpenSettings && !isBlocked && (
            <button
              onClick={(e) => onOpenSettings(book.id, e)}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
              title={t("vocabulary.settings.title")}
            >
              <Settings className="h-4 w-4 text-white" />
            </button>
          )}
        </div>

        <CardContent className="pt-4">
          {/* Book Title */}
          <div className="flex items-start justify-between mb-2">
            <h3 className={cn(
              "font-semibold text-text-primary line-clamp-1 transition-colors",
              !isBlocked && "group-hover:text-primary"
            )}>
              {book.name}
            </h3>
            {!isBlocked && (
              <ChevronRight className="h-4 w-4 text-text-tertiary group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
            )}
          </div>

          {/* Description */}
          <p className="text-xs text-text-secondary line-clamp-2 mb-3 min-h-[32px]">
            {book.description || t("vocabulary.noDescription")}
          </p>

          {/* Import Status Display */}
          {(isCurrentlyImporting || isCurrentlyFailed) && currentImportStatus && (
            <ImportStatusDisplay
              status={currentImportStatus}
              progress={importProgress}
              total={importTotal}
              error={importError}
              isRetrying={isRetrying}
              onRetry={retryFailed}
            />
          )}

          {/* Normal Stats (only show when not blocked) */}
          {!isBlocked && (
            <div className="space-y-2">
              {/* Progress bar */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">
                  {t("vocabulary.wordsCount", { count: book.word_count })}
                </span>
                <span className="text-primary font-medium">
                  {t("vocabulary.progress", { percent: progressPercent })}
                </span>
              </div>
              <Progress value={progressPercent} animated className="h-1.5" />

              {/* Last studied */}
              <div className="flex items-center gap-1.5 text-xs text-text-tertiary pt-1">
                <Clock className="h-3 w-3" />
                <span>
                  {lastStudied
                    ? t("vocabulary.lastStudied", { time: lastStudied })
                    : t("vocabulary.never")}
                </span>
              </div>
            </div>
          )}

          {/* Blocked state message */}
          {isBlocked && (
            <div className="text-xs text-text-tertiary flex items-center gap-1.5 pt-2">
              <Clock className="h-3 w-3" />
              <span>{t("vocabulary.import.blockedHint")}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================================================
// Empty State Component
// ============================================================================

interface EmptyStateProps {
  type: "user" | "system" | "search"
  onCreateBook?: () => void
}

/**
 * Empty state component for different scenarios
 */
function EmptyState({ type, onCreateBook }: EmptyStateProps) {
  const { t } = useTranslation()

  if (type === "search") {
    return (
      <motion.div
        className="text-center py-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Search className="h-16 w-16 mx-auto text-text-tertiary mb-4" />
        <p className="text-text-secondary">{t("vocabulary.noResults")}</p>
      </motion.div>
    )
  }

  if (type === "user") {
    return (
      <motion.div
        className="text-center py-12 px-6 border-2 border-dashed border-neutral-border rounded-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <BookOpen className="h-12 w-12 mx-auto text-text-tertiary mb-3" />
        <p className="text-text-secondary mb-4">
          {t("vocabulary.noUserBooks")}
        </p>
        {onCreateBook && (
          <Button onClick={onCreateBook} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("vocabulary.createBookBtn")}
          </Button>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div
      className="text-center py-16"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Sparkles className="h-16 w-16 mx-auto text-text-tertiary mb-4" />
      <p className="text-text-secondary">{t("vocabulary.noSystemBooks")}</p>
    </motion.div>
  )
}

// ============================================================================
// Loading Skeleton Component
// ============================================================================

/**
 * Loading skeleton for book cards
 */
function BookCardSkeleton() {
  return (
    <Card className="overflow-hidden animate-pulse">
      <div className="h-24 bg-neutral-border" />
      <CardContent className="pt-4 space-y-3">
        <div className="h-5 bg-neutral-border rounded w-3/4" />
        <div className="h-3 bg-neutral-border rounded w-full" />
        <div className="h-3 bg-neutral-border rounded w-2/3" />
        <div className="h-1.5 bg-neutral-border rounded w-full mt-4" />
        <div className="h-3 bg-neutral-border rounded w-1/2" />
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Main Page Component
// ============================================================================

/**
 * Main VocabularyBooks page component
 */
export function VocabularyBooks() {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()

  const [searchQuery, setSearchQuery] = useState("")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)

  // Use TanStack Query hook for fetching books
  const {
    userBooks,
    systemBooks,
    isLoading,
    isRefetching,
    error,
    refetch
  } = useVocabularyBooks({
    userId: user?.id,
    isAuthenticated,
    enabled: !authLoading
  })

  // Filter books by search query
  const filterBooks = useCallback(
    (books: VocabularyBookWithProgress[]) => {
      if (!searchQuery.trim()) return books
      const query = searchQuery.toLowerCase()
      return books.filter(
        (book) =>
          book.name.toLowerCase().includes(query) ||
          book.description?.toLowerCase().includes(query)
      )
    },
    [searchQuery]
  )

  const filteredSystemBooks = filterBooks(systemBooks)
  const filteredUserBooks = filterBooks(userBooks)

  const handleBookClick = (bookId: string) => {
    navigation.navigate(`/vocabulary/${bookId}`)
  }

  const handleNavigate = (itemId: string) => {
    navigation.navigate(`/${itemId}`)
  }

  const handleCreateSuccess = () => {
    // TanStack Query will automatically invalidate and refetch
  }

  const handleOpenSettings = (bookId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedBookId(bookId)
    setSettingsDialogOpen(true)
  }

  const handleSettingsSuccess = () => {
    // Settings saved, could refresh if needed
  }

  const totalWordCount =
    systemBooks.reduce((acc, book) => acc + book.word_count, 0) +
    userBooks.reduce((acc, book) => acc + book.word_count, 0)

  const totalBookCount = systemBooks.length + userBooks.length

  return (
    <MainLayout activeNav="vocabulary" onNavigate={handleNavigate}>
      <motion.div
        className="max-w-6xl mx-auto flex flex-col gap-lg"
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
      >
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {t("vocabulary.pageTitle")}
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              {isLoading ? (
                <span className="animate-pulse">
                  {t("vocabulary.loading")}
                </span>
              ) : (
                <>
                  {t("vocabulary.wordsCount", { count: totalWordCount })}{" "}
                  {t("vocabulary.acrossBooks", { count: totalBookCount })}
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              title={t("vocabulary.refresh")}
            >
              <RefreshCw
                className={cn("h-4 w-4", (isLoading || isRefetching) && "animate-spin")}
              />
            </Button>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
              <input
                type="text"
                placeholder={t("vocabulary.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-md border border-neutral-border bg-neutral-card text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            {/* Create Book Button - only show if authenticated */}
            {isAuthenticated && (
              <Button
                className="gap-2"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                {t("vocabulary.createBookBtn")}
              </Button>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <motion.div
            className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center justify-between"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span>{error.message || t("vocabulary.errors.fetchFailed")}</span>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              {t("vocabulary.retry")}
            </Button>
          </motion.div>
        )}

        {/* Loading State */}
        {isLoading && (
          <>
            {/* My Books Section Skeleton */}
            {isAuthenticated && (
              <section>
                <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  {t("vocabulary.myBooks")}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {[1, 2].map((i) => (
                    <BookCardSkeleton key={i} />
                  ))}
                </div>
              </section>
            )}

            {/* System Books Section Skeleton */}
            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t("vocabulary.systemBooks")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <BookCardSkeleton key={i} />
                ))}
              </div>
            </section>
          </>
        )}

        {/* Loaded Content */}
        {!isLoading && (
          <>
            {/* My Books Section - only show if authenticated */}
            {isAuthenticated && (
              <section>
                <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  {t("vocabulary.myBooks")}
                </h2>
                {filteredUserBooks.length > 0 ? (
                  <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                  >
                    {filteredUserBooks.map((book, index) => (
                      <VocabularyBookCard
                        key={book.id}
                        book={book}
                        onClick={() => handleBookClick(book.id)}
                        index={index}
                        isAuthenticated={isAuthenticated}
                        onOpenSettings={handleOpenSettings}
                        userId={user?.id}
                      />
                    ))}
                  </motion.div>
                ) : searchQuery ? (
                  <EmptyState type="search" />
                ) : (
                  <EmptyState
                    type="user"
                    onCreateBook={() => setCreateDialogOpen(true)}
                  />
                )}
              </section>
            )}

            {/* System Books Section */}
            <section>
              <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t("vocabulary.systemBooks")}
              </h2>
              {filteredSystemBooks.length > 0 ? (
                <motion.div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {filteredSystemBooks.map((book, index) => (
                    <VocabularyBookCard
                      key={book.id}
                      book={book}
                      onClick={() => handleBookClick(book.id)}
                      index={index}
                      isAuthenticated={isAuthenticated}
                      onOpenSettings={handleOpenSettings}
                      userId={user?.id}
                    />
                  ))}
                </motion.div>
              ) : searchQuery ? (
                <EmptyState type="search" />
              ) : (
                <EmptyState type="system" />
              )}
            </section>
          </>
        )}
      </motion.div>

      {/* Create Book Dialog */}
      {isAuthenticated && user && (
        <CreateBookDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          userId={user.id}
          onSuccess={handleCreateSuccess}
        />
      )}

      {/* Book Settings Dialog */}
      {isAuthenticated && user && selectedBookId && (
        <BookSettingsDialog
          open={settingsDialogOpen}
          onOpenChange={setSettingsDialogOpen}
          userId={user.id}
          bookId={selectedBookId}
          onSuccess={handleSettingsSuccess}
        />
      )}
    </MainLayout>
  )
}

export default VocabularyBooks
