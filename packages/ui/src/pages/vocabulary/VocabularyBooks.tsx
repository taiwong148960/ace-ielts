/**
 * Vocabulary Books Page
 * Displays all vocabulary books (user's and system) with search and navigation
 */

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import {
  BookOpen,
  Plus,
  Search,
  ChevronRight,
  Clock,
  Star,
  Sparkles,
  RefreshCw
} from "lucide-react"
import {
  cn,
  useNavigation,
  useTranslation,
  useAuth,
  getUserBooksWithProgress,
  getSystemBooksWithProgress,
  type VocabularyBookWithProgress
} from "@ace-ielts/core"

import { MainLayout } from "../../layout"
import {
  Card,
  CardContent,
  Button,
  Progress,
  fadeInUp,
  staggerContainer,
  staggerItem
} from "../../components"
import { CreateBookDialog } from "./CreateBookDialog"

/**
 * Book cover icon component
 */
function BookIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "ielts":
      return <Sparkles className={className} />
    case "academic":
      return <BookOpen className={className} />
    case "business":
      return <Star className={className} />
    default:
      return <BookOpen className={className} />
  }
}

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

/**
 * Single vocabulary book card component
 */
function VocabularyBookCard({
  book,
  onClick,
  index
}: {
  book: VocabularyBookWithProgress
  onClick: () => void
  index: number
}) {
  const { t } = useTranslation()

  const masteredCount = book.progress?.mastered_count ?? 0
  const progressPercent =
    book.word_count > 0
      ? Math.round((masteredCount / book.word_count) * 100)
      : 0
  const lastStudied = formatLastStudied(book.progress?.last_studied_at)

  return (
    <motion.div
      variants={staggerItem}
      initial="hidden"
      animate="visible"
      custom={index}
    >
      <Card
        className="group cursor-pointer hover:shadow-lg transition-all duration-300 overflow-hidden"
        onClick={onClick}
      >
        <div className={cn("h-24 relative", book.cover_color)}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute inset-0 flex items-center justify-center px-3">
            <span className="text-white/90 font-semibold text-base sm:text-lg md:text-xl truncate">
              {book.cover_text || book.name}
            </span>
          </div>
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-2 right-2 w-16 h-16 border border-white/30 rounded-full" />
            <div className="absolute bottom-2 left-2 w-8 h-8 border border-white/30 rounded-full" />
          </div>
          
        </div>

        <CardContent className="pt-4">
          {/* Book Title */}
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-text-primary line-clamp-1 group-hover:text-primary transition-colors">
              {book.name}
            </h3>
            <ChevronRight className="h-4 w-4 text-text-tertiary group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
          </div>

          {/* Description */}
          <p className="text-xs text-text-secondary line-clamp-2 mb-3 min-h-[32px]">
            {book.description || t("vocabulary.noDescription")}
          </p>

          {/* Stats */}
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
        </CardContent>
      </Card>
    </motion.div>
  )
}

/**
 * Empty state component
 */
function EmptyState({
  type,
  onCreateBook
}: {
  type: "user" | "system" | "search"
  onCreateBook?: () => void
}) {
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

/**
 * Loading skeleton component
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

/**
 * Main VocabularyBooks page component
 */
export function VocabularyBooks() {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()

  const [searchQuery, setSearchQuery] = useState("")
  const [userBooks, setUserBooks] = useState<VocabularyBookWithProgress[]>([])
  const [systemBooks, setSystemBooks] = useState<VocabularyBookWithProgress[]>(
    []
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  // Fetch books
  const fetchBooks = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const userId = user?.id || ""

      // Fetch system books (always available)
      const systemData = await getSystemBooksWithProgress(userId)
      setSystemBooks(systemData)

      // Fetch user books (only if authenticated)
      if (isAuthenticated && userId) {
        const userData = await getUserBooksWithProgress(userId)
        setUserBooks(userData)
      } else {
        setUserBooks([])
      }
    } catch (err) {
      console.error("Error fetching books:", err)
      setError(t("vocabulary.errors.fetchFailed"))
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, isAuthenticated, t])

  // Load books on mount
  useEffect(() => {
    if (!authLoading) {
      fetchBooks()
    }
  }, [fetchBooks, authLoading])

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
    // Refresh user books after creation
    fetchBooks()
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
              onClick={fetchBooks}
              disabled={isLoading}
              title={t("vocabulary.refresh")}
            >
              <RefreshCw
                className={cn("h-4 w-4", isLoading && "animate-spin")}
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
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={fetchBooks}>
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
    </MainLayout>
  )
}

export default VocabularyBooks
