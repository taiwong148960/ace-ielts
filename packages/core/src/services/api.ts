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
import { createLogger } from "../utils/logger"

// Create logger for this service
const logger = createLogger("DashboardApiService")


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
 * Calls Edge Function: dashboard-get-study-stats
 */
async function getStudyStats(userId: string): Promise<StudyStats> {
  const supabase = getSupabase()

  logger.debug("Fetching study stats via Edge Function", { userId })

  const { data, error } = await supabase.functions.invoke('dashboard-get-study-stats', {})

  if (error || !data?.success) {
    logger.warn("Failed to fetch study stats via Edge Function", { userId }, error)
    return {
      dayStreak: 0,
      todayMinutes: 0,
      totalMinutes: 0
    }
  }

  return data.data as StudyStats
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
 * Calls Edge Function: dashboard-get-browsing-history
 */
async function getBrowsingHistory(
  userId: string,
  limit: number = 10
): Promise<BrowsingHistoryItem[]> {
  const supabase = getSupabase()

  logger.debug("Fetching browsing history via Edge Function", { userId, limit })

  const { data, error } = await supabase.functions.invoke('dashboard-get-browsing-history', {
    body: { limit }
  })

  if (error || !data?.success) {
    logger.warn("Failed to fetch browsing history via Edge Function", { userId, limit }, error)
    return []
  }

  return data.data as BrowsingHistoryItem[]
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
 * Calls Edge Function: dashboard-get-takeaway-stats
 */
async function calculateTakeawayStats(
  userId: string,
  timeRange: TakeawayStats["timeRange"]
): Promise<TakeawayStats> {
  const supabase = getSupabase()
  
  logger.debug("Fetching takeaway stats via Edge Function", { userId, timeRange })

  const { data, error } = await supabase.functions.invoke('dashboard-get-takeaway-stats', {
    body: { timeRange }
  })

  if (error || !data?.success) {
    logger.warn("Failed to fetch takeaway stats via Edge Function", { userId, timeRange }, error)
    return {
      wordsViewed: 0,
      articlesRead: 0,
      videosWatched: 0,
      timeRange
    }
  }

  return data.data as TakeawayStats
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

