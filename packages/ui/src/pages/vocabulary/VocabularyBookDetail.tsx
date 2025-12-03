/**
 * Vocabulary Book Detail Page
 * Shows learning progress, statistics, and provides entry to learning session
 */

import { motion } from "framer-motion"
import {
  ArrowLeft,
  Brain,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  PlayCircle,
  Sparkles,
  Target
} from "lucide-react"
import { cn, useNavigation, useTranslation } from "@ace-ielts/core"

import { MainLayout } from "../../layout"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  fadeInUp
} from "../../components"

/**
 * Mock book detail data - will be replaced with real data later
 */
interface WordProgress {
  id: string
  word: string
  mastery: "new" | "learning" | "mastered"
  lastReviewed: string | null
  nextReview: string | null
}

interface BookStats {
  totalWords: number
  mastered: number
  learning: number
  newWords: number
  todayReview: number
  todayNew: number
  estimatedMinutes: number
  streak: number
  accuracy: number
}

const mockBookDetail = {
  id: "ielts-core",
  name: "IELTS Core 3000",
  description: "Essential vocabulary for IELTS Band 6-7",
  coverColor: "bg-gradient-to-br from-emerald-500 to-teal-600",
  stats: {
    totalWords: 3000,
    mastered: 1250,
    learning: 580,
    newWords: 1170,
    todayReview: 45,
    todayNew: 20,
    estimatedMinutes: 25,
    streak: 7,
    accuracy: 78
  } as BookStats,
  recentWords: [
    { id: "1", word: "procrastinate", mastery: "learning", lastReviewed: "2h ago", nextReview: "tomorrow" },
    { id: "2", word: "ubiquitous", mastery: "learning", lastReviewed: "1d ago", nextReview: "today" },
    { id: "3", word: "ephemeral", mastery: "mastered", lastReviewed: "3d ago", nextReview: "next week" },
    { id: "4", word: "pragmatic", mastery: "learning", lastReviewed: "5h ago", nextReview: "tomorrow" },
    { id: "5", word: "meticulous", mastery: "mastered", lastReviewed: "1w ago", nextReview: "2 weeks" }
  ] as WordProgress[],
  difficultWords: [
    { id: "6", word: "serendipity", mastery: "learning", lastReviewed: "2d ago", nextReview: "today" },
    { id: "7", word: "paradigm", mastery: "learning", lastReviewed: "1d ago", nextReview: "today" },
    { id: "8", word: "dichotomy", mastery: "new", lastReviewed: null, nextReview: null }
  ] as WordProgress[]
}


/**
 * Progress ring component
 */
function ProgressRing({
  progress,
  size = 120,
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
function WordListItem({ word, index }: { word: WordProgress; index: number }) {
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
      className="flex items-center justify-between py-3 border-b border-neutral-border last:border-0"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <div className="flex items-center gap-3">
        <span className="font-medium text-text-primary">{word.word}</span>
        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", masteryColors[word.mastery])}>
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
  days = 30,
  width = 300,
  height = 160
}: {
  masteredS?: number
  learningS?: number
  newS?: number
  days?: number
  width?: number
  height?: number
}) {
  const { t } = useTranslation()
  const pad = 16
  const w = width
  const h = height
  const toX = (d: number) => pad + (d / days) * (w - pad * 2)
  const toY = (r: number) => pad + (1 - r) * (h - pad * 2)
  const retention = (d: number, S: number) => Math.exp(-d / S)
  const buildPath = (S: number) => {
    const pts = Array.from({ length: days + 1 }, (_, i) => ({ x: toX(i), y: toY(retention(i, S)) }))
    return `M ${pts[0].x},${pts[0].y} ` + pts.slice(1).map(p => `L ${p.x},${p.y}`).join(" ")
  }
  const gridY = [0, 0.25, 0.5, 0.75, 1]
  const gridX = [0, 5, 10, 20, 30]
  return (
    <div className="w-full">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-neutral-border">
        <rect x={pad} y={pad} width={w - pad * 2} height={h - pad * 2} rx={8} className="fill-transparent" />
        {gridY.map(g => (
          <line key={`gy-${g}`} x1={pad} x2={w - pad} y1={toY(g)} y2={toY(g)} className="stroke-neutral-border" strokeDasharray="4 4" />
        ))}
        {gridX.map(g => (
          <line key={`gx-${g}`} y1={pad} y2={h - pad} x1={toX(g)} x2={toX(g)} className="stroke-neutral-border" strokeDasharray="4 4" />
        ))}
        <path d={buildPath(masteredS)} className="stroke-emerald-600 fill-none" strokeWidth={2} />
        <path d={buildPath(learningS)} className="stroke-amber-600 fill-none" strokeWidth={2} />
        <path d={buildPath(newS)} className="stroke-slate-600 fill-none" strokeWidth={2} />
      </svg>
        <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-600" />{t("vocabulary.bookDetail.mastered")}</div>
            <div className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-600" />{t("vocabulary.bookDetail.learning")}</div>
            <div className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-slate-600" />{t("vocabulary.bookDetail.new")}</div>
          </div>
          <span>0–30d</span>
        </div>
    </div>
  )
}

/**
 * Main VocabularyBookDetail page component
 */
export function VocabularyBookDetail() {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const book = mockBookDetail

  const masteredPercent = Math.round((book.stats.mastered / book.stats.totalWords) * 100)
  const learningPercent = Math.round((book.stats.learning / book.stats.totalWords) * 100)
  const newPercent = Math.round((book.stats.newWords / book.stats.totalWords) * 100)

  const handleBack = () => {
    navigation.navigate("/vocabulary")
  }

  const handleStartLearning = () => {
    navigation.navigate(`/vocabulary/${book.id}/learn`)
  }

  const handleNavigate = (itemId: string) => {
    navigation.navigate(`/${itemId}`)
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
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-text-primary">{book.name}</h1>
            <p className="text-text-secondary text-sm">{book.description}</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          {/* Left Column - Overview & Today's Goal */}
          <div className="lg:col-span-2 space-y-lg">
            {/* Overview Card */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  {t("vocabulary.bookDetail.overview")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-center gap-8">
                  {/* Progress Ring */}
                  <ProgressRing
                    progress={masteredPercent}
                    label={t("vocabulary.bookDetail.mastered")}
                    value={`${masteredPercent}%`}
                  />

                  {/* Stats Breakdown */}
                  <div className="flex-1 grid grid-cols-3 gap-4 w-full">
                    <div className="text-center p-4 rounded-lg bg-emerald-50">
                      <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-600 mb-2" />
                      <p className="text-2xl font-bold text-emerald-700">{book.stats.mastered}</p>
                      <p className="text-xs text-emerald-600">{t("vocabulary.bookDetail.mastered")}</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-amber-50">
                      <Brain className="h-6 w-6 mx-auto text-amber-600 mb-2" />
                      <p className="text-2xl font-bold text-amber-700">{book.stats.learning}</p>
                      <p className="text-xs text-amber-600">{t("vocabulary.bookDetail.learning")}</p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-slate-50">
                      <Sparkles className="h-6 w-6 mx-auto text-slate-600 mb-2" />
                      <p className="text-2xl font-bold text-slate-700">{book.stats.newWords}</p>
                      <p className="text-xs text-slate-600">{t("vocabulary.bookDetail.new")}</p>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-text-secondary">
                      {t("vocabulary.wordsCount", { count: book.stats.totalWords })}
                    </span>
                  </div>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="h-3 bg-neutral-border rounded-full overflow-hidden flex">
                          <motion.div
                            className="bg-emerald-500 h-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(book.stats.mastered / book.stats.totalWords) * 100}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                          />
                          <motion.div
                            className="bg-amber-500 h-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(book.stats.learning / book.stats.totalWords) * 100}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                          />
                          <motion.div
                            className="bg-slate-400 h-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(book.stats.newWords / book.stats.totalWords) * 100}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span>{t("vocabulary.bookDetail.mastered")}: {masteredPercent}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Brain className="h-4 w-4 text-amber-600" />
                            <span>{t("vocabulary.bookDetail.learning")}: {learningPercent}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-slate-600" />
                            <span>{t("vocabulary.bookDetail.new")}: {newPercent}%</span>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  {t("vocabulary.bookDetail.forgettingCurve")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 text-xs text-text-secondary">{t("vocabulary.bookDetail.retentionProbability")}</div>
                <ForgettingCurveChart
                  masteredS={30}
                  learningS={7}
                  newS={2}
                  days={30}
                  width={320}
                  height={160}
                />
                <div className="mt-3 text-xs text-text-tertiary">{t("vocabulary.bookDetail.fsrsHint")}</div>
              </CardContent>
            </Card>

            {/* Today's Goal Card moved to right column */}
          </div>

          {/* Right Column - Stats & Words */}
          <div className="space-y-lg">
            {/* Today's Goal Card (compact, top-right) */}
            <Card className={cn("relative overflow-hidden", book.coverColor)}>
              <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-black/5 to-transparent" />
              <CardContent className="relative p-4 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold mb-1 flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {t("vocabulary.bookDetail.todayGoal")}
                    </h3>
                    <div className="text-xs text-white/90 truncate flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t("vocabulary.bookDetail.wordsToReview", { count: book.stats.todayReview })}
                      </span>
                      <span className="opacity-60">•</span>
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        {t("vocabulary.bookDetail.newWordsToday", { count: book.stats.todayNew })}
                      </span>
                      <span className="opacity-60">•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {t("vocabulary.bookDetail.estimatedTime", { minutes: book.stats.estimatedMinutes })}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={handleStartLearning}
                    className="bg-white text-primary hover:bg-white/90 gap-1 shadow-md h-8 px-2"
                    size="sm"
                  >
                    <PlayCircle className="h-4 w-4" />
                    <span className="hidden md:inline">{t("vocabulary.bookDetail.startSession")}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>


            {/* Recent Words */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  {t("vocabulary.bookDetail.recentWords")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {book.recentWords.map((word, index) => (
                  <WordListItem key={word.id} word={word} index={index} />
                ))}
              </CardContent>
            </Card>

            {/* Difficult Words */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-600">
                  <Brain className="h-4 w-4" />
                  {t("vocabulary.bookDetail.difficult")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {book.difficultWords.map((word, index) => (
                  <WordListItem key={word.id} word={word} index={index} />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </MainLayout>
  )
}

export default VocabularyBookDetail
