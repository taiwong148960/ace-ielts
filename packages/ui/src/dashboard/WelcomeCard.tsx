/**
 * Welcome Card Component
 * AI-Enhanced Design System - Sage Theme
 */

import React from "react"
import { Flame, Target, Clock, User, Sparkles } from "lucide-react"
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
      className="flex items-center gap-2.5 px-4 py-2.5 bg-neutral-card border border-neutral-border/50 rounded-xl shadow-sm hover:shadow-md transition-shadow"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${iconColor}15` }}>
        <Icon className="h-4 w-4" strokeWidth={2} style={{ color: iconColor }} />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-bold text-text-primary leading-tight">{value}</span>
        <span className="text-xs text-text-secondary leading-tight">{label}</span>
      </div>
    </motion.div>
  )
}

/**
 * User avatar component with fallback and gradient border
 */
interface UserAvatarProps {
  avatarUrl?: string
  name: string
  size?: "sm" | "md" | "lg"
}

function UserAvatar({ avatarUrl, name, size = "md" }: UserAvatarProps) {
  const sizeClasses = {
    sm: "w-10 h-10 text-xs",
    md: "w-14 h-14 text-sm",
    lg: "w-18 h-18 text-base"
  }
  
  const initials = name
    .split(" ")
    .map(word => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  if (avatarUrl) {
    return (
      <motion.div
        className="relative"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-ai p-[2px]">
          <div className="w-full h-full rounded-full bg-neutral-card" />
        </div>
        <img
          src={avatarUrl}
          alt={name}
          className={cn(
            sizeClasses[size],
            "relative rounded-full object-cover"
          )}
        />
      </motion.div>
    )
  }

  return (
    <motion.div
      className={cn(
        sizeClasses[size],
        "rounded-full bg-gradient-to-br from-primary to-ai flex items-center justify-center text-white font-semibold shadow-glow-sm"
      )}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {initials || <User className="w-1/2 h-1/2" />}
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

function ProgressCard({ currentLevel, goalLevel, delay = 0 }: ProgressCardProps) {
  const { t } = useTranslation()
  const progress = calculateProgress(currentLevel, goalLevel)
  const levelKey = getLevelKey(currentLevel)

  return (
    <motion.div
      className="flex-1 px-5 py-4 bg-neutral-card border border-neutral-border/50 rounded-xl shadow-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary-50">
            <Target className="h-4 w-4 text-primary" strokeWidth={2} />
          </div>
          <span className="text-sm font-medium text-text-primary">
            {t("dashboard.progressToGoal", { goal: goalLevel })}
          </span>
        </div>
        <span className="text-xl font-bold text-gradient">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Progress bar */}
      <Progress 
        value={progress} 
        variant="ai"
        size="default"
        className="mb-3" 
        animated
      />

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
 * Features AI-enhanced gradient styling
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
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className={cn("overflow-hidden py-5 px-6 relative", className)}>
        {/* Subtle gradient overlay */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-ai/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="relative">
          {/* Header: Avatar + Greeting */}
          <div className="flex items-center gap-4 mb-4">
            <UserAvatar avatarUrl={user.avatarUrl} name={user.name} size="md" />
            <div>
              <motion.div
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <h1 className="text-xl font-bold text-text-primary">
                  {t(`dashboard.greeting.${greeting}`)}, {user.name}!
                </h1>
                <Sparkles className="h-5 w-5 text-ai" />
              </motion.div>
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
            <div className="flex flex-col justify-center gap-3">
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
        </div>
      </Card>
    </motion.div>
  )
}

export default WelcomeCard
