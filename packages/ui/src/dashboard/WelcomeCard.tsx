import React from "react"
import { Flame, Target, Clock, User } from "lucide-react"
import { motion } from "framer-motion"
import { cn, getGreeting, useTranslation, type StudyStats, type UserProfile } from "@ace-ielts/core"
import { Card } from "../components/card"
import { Progress } from "../components/progress"

interface WelcomeCardProps {
  user: UserProfile
  studyStats: StudyStats
  className?: string
}

/**
 * Get encouragement message based on streak
 */
function getEncouragementKey(streak: number): string {
  if (streak >= 30) return "streak_legendary"
  if (streak >= 14) return "streak_high"
  if (streak >= 7) return "streak_medium"
  return "streak_low"
}

/**
 * Get level description key (rounds to nearest 0.5)
 */
function getLevelKey(level: number): string {
  const rounded = Math.round(level * 2) / 2
  return String(rounded)
}

/**
 * Calculate progress percentage towards goal
 */
function calculateProgress(current: number, goal: number, baseline: number = 4): number {
  const totalRange = goal - baseline
  const currentProgress = current - baseline
  return Math.min(100, Math.max(0, (currentProgress / totalRange) * 100))
}

/**
 * Stat badge component - pill shaped with icon, bold number, and description
 */
interface StatBadgeProps {
  icon: React.ElementType
  value: string
  label: string
  iconColor?: string
  delay?: number
}

function StatBadge({ icon: Icon, value, label, iconColor, delay = 0 }: StatBadgeProps) {
  return (
    <motion.div
      className="flex items-center gap-2.5 px-4 py-2 bg-white border border-neutral-border rounded-full"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Icon className="h-4 w-4" strokeWidth={2} style={{ color: iconColor }} />
      <div className="flex flex-col">
        <span className="text-sm font-bold text-text-primary leading-tight">{value}</span>
        <span className="text-xs text-text-secondary leading-tight">{label}</span>
      </div>
    </motion.div>
  )
}

/**
 * Progress card component
 */
interface ProgressCardProps {
  currentLevel: number
  goalLevel: number
  delay?: number
}

/**
 * User avatar component with fallback
 */
interface UserAvatarProps {
  avatarUrl?: string
  name: string
  size?: "sm" | "md" | "lg"
}

function UserAvatar({ avatarUrl, name, size = "md" }: UserAvatarProps) {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-sm",
    lg: "w-16 h-16 text-base"
  }
  
  const initials = name
    .split(" ")
    .map(word => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  if (avatarUrl) {
    return (
      <motion.img
        src={avatarUrl}
        alt={name}
        className={cn(
          sizeClasses[size],
          "rounded-full object-cover ring-2 ring-white shadow-md"
        )}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
    )
  }

  return (
    <motion.div
      className={cn(
        sizeClasses[size],
        "rounded-full bg-gradient-to-br from-[#0E7569] to-[#0B5C52] flex items-center justify-center text-white font-semibold ring-2 ring-white shadow-md"
      )}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {initials || <User className="w-1/2 h-1/2" />}
    </motion.div>
  )
}

function ProgressCard({ currentLevel, goalLevel, delay = 0 }: ProgressCardProps) {
  const { t } = useTranslation()
  const progress = calculateProgress(currentLevel, goalLevel)
  const levelKey = getLevelKey(currentLevel)

  return (
    <motion.div
      className="flex-1 px-4 py-3 bg-white border border-neutral-border rounded-xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4" strokeWidth={2} style={{ color: "#0E7569" }} />
          <span className="text-sm font-medium text-text-primary">
            {t("dashboard.progressToGoal", { goal: goalLevel })}
          </span>
        </div>
        <span className="text-xl font-bold text-text-primary">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Progress bar */}
      <Progress value={progress} className="h-1.5 mb-2" indicatorColor="#3B82F6" />

      {/* Level info */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-secondary">
          {t("dashboard.currentLevel")}: <span className="font-semibold text-text-primary">{t("dashboard.levelLabel", { band: currentLevel })}</span>
        </span>
        <span className="text-xs text-text-secondary">
          {t("dashboard.goalBand", { band: goalLevel })}
        </span>
      </div>

      {/* Level description */}
      <p className="text-xs text-text-tertiary">
        {t(`dashboard.levelDescription.${levelKey}`)}
      </p>
    </motion.div>
  )
}

/**
 * Welcome card component showing greeting, progress, and stats
 */
export function WelcomeCard({ user, studyStats, className }: WelcomeCardProps) {
  const { t } = useTranslation()
  const greeting = getGreeting()
  const encouragementKey = getEncouragementKey(studyStats.dayStreak)
  const totalHours = Math.floor(studyStats.totalMinutes / 60)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Card className={cn("overflow-hidden py-5 px-6", className)}>
        {/* Header: Avatar + Greeting */}
        <div className="flex items-center gap-4 mb-3">
          <UserAvatar avatarUrl={user.avatarUrl} name={user.name} size="md" />
          <div>
            <motion.h1
              className="text-xl font-bold text-text-primary"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {t(`dashboard.greeting.${greeting}`)}, {user.name}!
            </motion.h1>
            <motion.p
              className="text-sm text-text-secondary mt-0.5"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {t(`dashboard.encouragement.${encouragementKey}`)}
            </motion.p>
          </div>
        </div>

        {/* Main content: Progress card + Stats badges */}
        <div className="flex items-stretch gap-4">
          {/* Left: Progress Card */}
          <ProgressCard
            currentLevel={user.currentLevel}
            goalLevel={user.goalBand}
            delay={0.3}
          />

          {/* Right: Stats Badges */}
          <div className="flex flex-col justify-center gap-2">
            <StatBadge
              icon={Flame}
              value={t("dashboard.streakDays", { count: studyStats.dayStreak })}
              label={t("dashboard.streakLabel")}
              iconColor="#F59E0B"
              delay={0.4}
            />
            <StatBadge
              icon={Clock}
              value={t("dashboard.studyHours", { hours: totalHours })}
              label={t("dashboard.studyTimeLabel")}
              iconColor="#3B82F6"
              delay={0.5}
            />
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

export default WelcomeCard

