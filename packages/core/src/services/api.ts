/**
 * API Service Layer
 * Handles dashboard data fetching from Supabase
 * Following the Interface Segregation Principle (ISP)
 */

import type {
  DashboardData,
  TakeawayStats,
  UserProfile,
  StudyStats,
  SkillsBreakdown,
  SkillScore,
  PracticeTask,
  BrowsingHistoryItem,
  MockTestStatus,
  BlogArticle
} from "../types"
import { isSupabaseInitialized, getSupabase } from "./supabase"
import { getCurrentUser } from "./auth"
import { userToProfile } from "../types/auth"

/**
 * Configuration for API behavior
 */
interface ApiConfig {
  baseUrl?: string
}

/**
 * Default configuration
 */
const defaultConfig: ApiConfig = {}

let config = { ...defaultConfig }

/**
 * Configure API behavior
 */
export function configureApi(newConfig: Partial<ApiConfig>) {
  config = { ...config, ...newConfig }
}

/**
 * Dashboard API interface
 */
export interface IDashboardApi {
  getDashboardData(): Promise<DashboardData>
  getTakeawayStats(timeRange: TakeawayStats["timeRange"]): Promise<TakeawayStats>
}

/**
 * Get user profile from auth user
 */
async function getUserProfile(): Promise<UserProfile> {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new Error("User not authenticated")
  }

  const profile = userToProfile(user)
  const createdAt = new Date(user.created_at)

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    avatarUrl: profile.avatarUrl || undefined,
    goalBand: 7.0, // Default goal band, can be extended with user_settings table
    currentLevel: 6.0, // Default current level, can be calculated from actual scores
    joinedDate: createdAt.toISOString()
  }
}

/**
 * Get study statistics from user_book_progress and review_logs
 */
async function getStudyStats(userId: string): Promise<StudyStats> {
  const supabase = getSupabase()

  // Get max streak from user_book_progress
  const { data: progressData, error: progressError } = await supabase
    .from("user_book_progress")
    .select("streak_days")
    .eq("user_id", userId)

  if (progressError) {
    console.error("Error fetching book progress:", progressError)
  }

  const dayStreak = progressData && progressData.length > 0
    ? Math.max(...progressData.map(p => p.streak_days || 0))
    : 0

  // Calculate today's study time from review_logs (estimate: 30 seconds per review)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStart = today.toISOString()

  const { data: todayReviews, error: todayError } = await supabase
    .from("review_logs")
    .select("review_time_ms")
    .eq("user_id", userId)
    .gte("reviewed_at", todayStart)

  if (todayError) {
    console.error("Error fetching today's reviews:", todayError)
  }

  const todayMinutes = todayReviews
    ? Math.round(
        (todayReviews.reduce((sum, r) => sum + (r.review_time_ms || 30000), 0) / 1000) / 60
      )
    : 0

  // Calculate total study time from all review_logs
  const { data: allReviews, error: allError } = await supabase
    .from("review_logs")
    .select("review_time_ms")
    .eq("user_id", userId)

  if (allError) {
    console.error("Error fetching all reviews:", allError)
  }

  const totalMinutes = allReviews
    ? Math.round(
        (allReviews.reduce((sum, r) => sum + (r.review_time_ms || 30000), 0) / 1000) / 60
      )
    : 0

  return {
    dayStreak,
    todayMinutes,
    totalMinutes
  }
}

/**
 * Get skills breakdown (default values for now)
 */
function getSkillsBreakdown(): SkillsBreakdown {
  // Default skill scores - can be extended with actual test results
  const skills: SkillScore[] = [
    {
      skill: "listening",
      score: 6.5,
      maxScore: 9.0,
      hasWarning: false
    },
    {
      skill: "reading",
      score: 6.5,
      maxScore: 9.0,
      hasWarning: false
    },
    {
      skill: "writing",
      score: 6.0,
      maxScore: 9.0,
      hasWarning: true
    },
    {
      skill: "speaking",
      score: 6.5,
      maxScore: 9.0,
      hasWarning: false
    }
  ]

  return { skills }
}

/**
 * Get practice tasks (default tasks for now)
 */
function getPracticeTasks(): PracticeTask[] {
  // Default practice tasks - can be extended with actual task management
  return [
    {
      id: "task-1",
      type: "vocabulary",
      title: "Review 20 words",
      duration: 15,
      completed: false,
      priority: "high"
    },
    {
      id: "task-2",
      type: "reading",
      title: "Complete reading passage",
      duration: 20,
      completed: false,
      priority: "medium"
    },
    {
      id: "task-3",
      type: "writing",
      title: "Practice essay writing",
      duration: 30,
      completed: false,
      priority: "high"
    }
  ]
}

/**
 * Get browsing history from review_logs
 */
async function getBrowsingHistory(
  userId: string,
  limit: number = 10
): Promise<BrowsingHistoryItem[]> {
  const supabase = getSupabase()

  // Get recent reviews with word information
  const { data: reviews, error } = await supabase
    .from("review_logs")
    .select("id, word_id, book_id, reviewed_at")
    .eq("user_id", userId)
    .order("reviewed_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error fetching browsing history:", error)
    return []
  }

  if (!reviews || reviews.length === 0) {
    return []
  }

  // Get unique word IDs and book IDs
  const wordIds = Array.from(new Set(reviews.map(r => r.word_id)))
  const bookIds = Array.from(new Set(reviews.map(r => r.book_id)))

  // Fetch words and books in parallel
  const [wordsResult, booksResult] = await Promise.all([
    supabase
      .from("vocabulary_words")
      .select("id, word, book_id")
      .in("id", wordIds),
    supabase
      .from("vocabulary_books")
      .select("id, name")
      .in("id", bookIds)
  ])

  if (wordsResult.error) {
    console.error("Error fetching words:", wordsResult.error)
    return []
  }

  if (booksResult.error) {
    console.error("Error fetching books:", booksResult.error)
    return []
  }

  // Create maps for quick lookup
  const wordsMap = new Map(
    (wordsResult.data || []).map(w => [w.id, w])
  )
  const booksMap = new Map(
    (booksResult.data || []).map(b => [b.id, b])
  )

  // Build browsing history items
  const historyItems: BrowsingHistoryItem[] = []

  for (const review of reviews) {
    const word = wordsMap.get(review.word_id)
    const book = booksMap.get(review.book_id)

    if (word) {
      historyItems.push({
        id: review.id,
        type: "word" as const,
        title: word.word,
        source: book?.name || "Vocabulary",
        timestamp: review.reviewed_at,
        url: undefined
      })
    }
  }

  return historyItems
}

/**
 * Get mock test status (default for now)
 */
function getMockTestStatus(): MockTestStatus {
  return {
    daysSinceLastTest: 0,
    lastTestScore: undefined,
    lastTestDate: undefined
  }
}

/**
 * Get blog articles (default articles for now)
 */
function getBlogArticles(): BlogArticle[] {
  return [
    {
      id: "blog-1",
      title: "10 Tips to Improve Your IELTS Writing Score",
      url: "https://aceielts.com/blog/10-tips-ielts-writing",
      thumbnailUrl: undefined,
      category: "Writing",
      readTimeMinutes: 5,
      publishedAt: new Date().toISOString()
    },
    {
      id: "blog-2",
      title: "Common Vocabulary Mistakes in IELTS Speaking",
      url: "https://aceielts.com/blog/vocabulary-mistakes-speaking",
      thumbnailUrl: undefined,
      category: "Speaking",
      readTimeMinutes: 4,
      publishedAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: "blog-3",
      title: "How to Manage Time in IELTS Reading Test",
      url: "https://aceielts.com/blog/time-management-reading",
      thumbnailUrl: undefined,
      category: "Reading",
      readTimeMinutes: 6,
      publishedAt: new Date(Date.now() - 172800000).toISOString()
    }
  ]
}

/**
 * Calculate takeaway stats for a given time range
 */
async function calculateTakeawayStats(
  userId: string,
  timeRange: TakeawayStats["timeRange"]
): Promise<TakeawayStats> {
  const supabase = getSupabase()
  
  // Calculate date range
  const now = new Date()
  let startDate: Date

  switch (timeRange) {
    case "day":
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      break
    case "week":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case "month":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case "all":
      startDate = new Date(0) // Beginning of time
      break
  }

  // Count unique words viewed from review_logs
  const { data: reviews, error } = await supabase
    .from("review_logs")
    .select("word_id")
    .eq("user_id", userId)
    .gte("reviewed_at", startDate.toISOString())

  if (error) {
    console.error("Error fetching reviews for takeaway stats:", error)
  }

  const uniqueWords = reviews
    ? new Set(reviews.map(r => r.word_id)).size
    : 0

  // For now, articles and videos are not tracked, return 0
  return {
    wordsViewed: uniqueWords,
    articlesRead: 0,
    videosWatched: 0,
    timeRange
  }
}

/**
 * Dashboard API implementation
 */
export const dashboardApi: IDashboardApi = {
  /**
   * Fetch complete dashboard data from Supabase
   */
  async getDashboardData(): Promise<DashboardData> {
    if (!isSupabaseInitialized()) {
      throw new Error("Supabase not initialized")
    }

    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }

    const userId = user.id

    // Fetch all dashboard data in parallel
    const [
      userProfile,
      studyStats,
      skillsBreakdown,
      practiceTasks,
      takeawayStats,
      browsingHistory,
      mockTestStatus,
      blogArticles
    ] = await Promise.all([
      getUserProfile(),
      getStudyStats(userId),
      Promise.resolve(getSkillsBreakdown()),
      Promise.resolve(getPracticeTasks()),
      calculateTakeawayStats(userId, "week"),
      getBrowsingHistory(userId),
      Promise.resolve(getMockTestStatus()),
      Promise.resolve(getBlogArticles())
    ])

    return {
      user: userProfile,
      studyStats,
      skillsBreakdown,
      practiceTasks,
      takeawayStats,
      browsingHistory,
      mockTestStatus,
      blogArticles
    }
  },

  /**
   * Fetch takeaway statistics by time range from Supabase
   */
  async getTakeawayStats(
    timeRange: TakeawayStats["timeRange"]
  ): Promise<TakeawayStats> {
    if (!isSupabaseInitialized()) {
      throw new Error("Supabase not initialized")
    }

    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }

    return calculateTakeawayStats(user.id, timeRange)
  }
}

export default dashboardApi

