/**
 * Shared Dashboard Page Component
 * Uses platform adapters for cross-platform compatibility
 */

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  dashboardApi,
  useNavigation,
  useTranslation,
  useAuth,
  userToProfile,
  type BlogArticle,
  type DashboardData,
  type TakeawayStats
} from "@ace-ielts/core"

import { MainLayout } from "../layout"
import {
  WelcomeCard,
  InflectionCard,
  SkillsBreakdownCard,
  TakeawayCard,
  BlogCard
} from "../dashboard"

/**
 * Error state component
 */
function ErrorState({ message }: { message: string }) {
  const { t } = useTranslation()

  return (
    <MainLayout>
      <div className="flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <div className="text-functional-error text-lg font-medium mb-2">
            {t("dashboard.error")}
          </div>
          <div className="text-text-secondary text-sm">{message}</div>
        </motion.div>
      </div>
    </MainLayout>
  )
}

/**
 * Shared Dashboard page component
 * Works across both Extension and Web platforms via useNavigation adapter
 */
export function Dashboard() {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { user: authUser } = useAuth()
  
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const dashboardData = await dashboardApi.getDashboardData()
        
        // If user is authenticated, merge real user data with dashboard data
        if (authUser) {
          const profile = userToProfile(authUser)
          dashboardData.user = {
            ...dashboardData.user,
            id: profile.id,
            name: profile.name,
            email: profile.email,
            avatarUrl: profile.avatarUrl || undefined
          }
        }
        
        setData(dashboardData)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("dashboard.failedToLoad")
        )
      }
    }

    fetchData()
  }, [t, authUser])

  const handleTimeRangeChange = async (
    range: TakeawayStats["timeRange"]
  ): Promise<TakeawayStats> => {
    return dashboardApi.getTakeawayStats(range)
  }

  const handleTaskToggle = (taskId: string, completed: boolean) => {
    if (!data) return
    setData({
      ...data,
      practiceTasks: data.practiceTasks.map((task) =>
        task.id === taskId ? { ...task, completed } : task
      )
    })
  }

  const handleStartPractice = (_taskId: string) => {
    // Will navigate to practice page when implemented
    navigation.navigate("/practice")
  }

  const handleViewAllBlog = () => {
    navigation.openExternal("https://aceielts.com/blog")
  }

  const handleArticleClick = (article: BlogArticle) => {
    navigation.openExternal(article.url)
  }

  const handleNavigate = (itemId: string) => {
    navigation.navigate(`/${itemId}`)
  }

  if (error) {
    return <ErrorState message={error} />
  }

  if (!data) {
    return <MainLayout><></></MainLayout>
  }

  return (
    <MainLayout activeNav="dashboard" onNavigate={handleNavigate}>
      <motion.div
        className="max-w-7xl mx-auto flex flex-col gap-lg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <WelcomeCard user={data.user} studyStats={data.studyStats} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg items-stretch">
          <div className="lg:col-span-2">
            <InflectionCard
              tasks={data.practiceTasks}
              onToggleTask={handleTaskToggle}
              onStartPractice={handleStartPractice}
              className="h-full"
            />
          </div>

          <div>
            <SkillsBreakdownCard
              skillsBreakdown={data.skillsBreakdown}
              className="h-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg items-stretch">
          <div className="lg:col-span-2">
            <TakeawayCard
              initialStats={data.takeawayStats}
              browsingHistory={data.browsingHistory}
              onTimeRangeChange={handleTimeRangeChange}
              className="h-full"
            />
          </div>

          <div>
            <BlogCard
              articles={data.blogArticles}
              onViewAll={handleViewAllBlog}
              onArticleClick={handleArticleClick}
              className="h-full"
            />
          </div>
        </div>
      </motion.div>
    </MainLayout>
  )
}

export default Dashboard

