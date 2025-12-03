/**
 * Vocabulary Learning Page
 * Word card learning interface with spaced repetition grading
 * Based on prototype design (CogniWord reference)
 */

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  BookOpen,
  Maximize2,
  Newspaper,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Tv,
  Volume2
} from "lucide-react"
import { cn, useNavigation, useTranslation } from "@ace-ielts/core"

import { MainLayout } from "../../layout"
import {
  Card,
  CardContent,
  Button,
  Progress,
  fadeInUp
} from "../../components"

/**
 * Mock word data - will be replaced with real data later
 */
interface ContextExample {
  source: string
  sourceType: "news" | "media" | "book"
  text: string
  translation: string
}

interface WordData {
  id: string
  word: string
  phonetic: string
  partOfSpeech: string
  definition: string
  definitionCn: string
  etymology: {
    breakdown: string
    meaning: string
  }
  synonyms: string[]
  antonyms: string[]
  contexts: ContextExample[]
}

const mockCurrentWord: WordData = {
  id: "1",
  word: "PROCRASTINATE",
  phonetic: "/prəˈkræstɪneɪt/",
  partOfSpeech: "v.",
  definition: "(often to) delay or postpone action; put off doing something.",
  definitionCn: "To delay or postpone doing something, often due to various reasons.",
  etymology: {
    breakdown: "pro- (forward) + crastinus (of tomorrow)",
    meaning: "= push to tomorrow"
  },
  synonyms: ["delay", "put off"],
  antonyms: ["hasten", "rush", "accelerate", "advance"],
  contexts: [
    {
      source: "The New York Times (Work-Life Section)",
      sourceType: "news",
      text: '"Psychologists say we often procrastinate not because we are lazy, but because we are managing negative moods like anxiety."',
      translation: "Psychologists suggest that procrastination is often not about laziness, but about managing negative emotions like anxiety."
    },
    {
      source: "Friends S02E05",
      sourceType: "media",
      text: '"I\'m gonna go procrastinate by cleaning my apartment."',
      translation: "I'm going to procrastinate by cleaning my apartment instead."
    }
  ]
}

const mockSessionData = {
  currentIndex: 1,
  totalWords: 45,
  bookId: "ielts-core",
  bookName: "IELTS Core 3000"
}

/**
 * Source icon component
 */
function SourceIcon({ type }: { type: "news" | "media" | "book" }) {
  switch (type) {
    case "news":
      return <Newspaper className="h-4 w-4" />
    case "media":
      return <Tv className="h-4 w-4" />
    default:
      return <BookOpen className="h-4 w-4" />
  }
}

/**
 * Audio player component for YouGlish-style video
 */
function VideoPlayerPlaceholder() {
  const { t } = useTranslation()
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <Card className="bg-neutral-background border border-neutral-border">
      <CardContent className="pt-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          {t("vocabulary.learning.videoExamples")}
        </h3>

        {/* Video Placeholder */}
        <div className="relative bg-slate-900 rounded-lg overflow-hidden aspect-video mb-3">
          {/* Waveform visualization placeholder */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-end gap-1 h-16">
              {Array.from({ length: 40 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-emerald-400/60 rounded-full"
                  animate={{
                    height: isPlaying
                      ? [8, Math.random() * 60 + 8, 8]
                      : 8
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: isPlaying ? Infinity : 0,
                    delay: i * 0.02
                  }}
                  style={{ height: 8 }}
                />
              ))}
            </div>
          </div>

          {/* Word overlay */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-black/60 backdrop-blur-sm rounded px-3 py-1.5 inline-block">
              <span className="text-white font-medium tracking-wide">PROCRASTINATE</span>
            </div>
          </div>

          {/* YouGlish branding */}
          <div className="absolute top-3 right-3 text-white/60 text-xs font-medium">
            YouGlish
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Volume2 className="h-4 w-4" />
            </Button>
            <span className="text-xs text-text-secondary ml-2">0:09 /s</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <SkipBack className="h-4 w-4" />
            </Button>
            <span className="text-xs text-text-secondary">
              {t("vocabulary.learning.prevNext")}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 ml-2">
              <span className="text-[10px] font-bold border border-current rounded px-1">CC</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Spaced repetition grading buttons
 */
function SpacedRepetitionGrading({
  onGrade
}: {
  onGrade: (grade: "forgot" | "hard" | "good" | "easy") => void
}) {
  const { t } = useTranslation()

  const buttons = [
    {
      grade: "forgot" as const,
      label: t("vocabulary.learning.forgot"),
      interval: t("vocabulary.learning.interval.1m"),
      color: "bg-red-500 hover:bg-red-600 text-white"
    },
    {
      grade: "hard" as const,
      label: t("vocabulary.learning.hard"),
      interval: t("vocabulary.learning.interval.10m"),
      color: "bg-amber-500 hover:bg-amber-600 text-white"
    },
    {
      grade: "good" as const,
      label: t("vocabulary.learning.good"),
      interval: t("vocabulary.learning.interval.1d"),
      color: "bg-emerald-500 hover:bg-emerald-600 text-white"
    }
  ]

  return (
    <Card className="bg-neutral-card border-t-2 border-neutral-border">
      <CardContent className="pt-4">
        <h3 className="text-sm font-medium text-text-secondary text-center mb-4">
          —— {t("vocabulary.learning.spacedRepetition")} ——
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {buttons.map((btn) => (
            <motion.button
              key={btn.grade}
              onClick={() => onGrade(btn.grade)}
              className={cn(
                "py-3 px-4 rounded-lg font-medium transition-all",
                btn.color
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="block">{btn.label}</span>
              <span className="text-xs opacity-80">({btn.interval})</span>
            </motion.button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Word card component
 */
function WordCard({ word }: { word: WordData }) {
  const { t } = useTranslation()

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6 pb-4">
        {/* Word Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-text-primary tracking-tight">
                {word.word}
              </h1>
              <motion.button
                className="p-2 rounded-full bg-neutral-background hover:bg-accent-blue text-text-secondary hover:text-primary transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Volume2 className="h-5 w-5" />
              </motion.button>
              <span className="text-text-secondary font-mono text-lg">
                {word.phonetic}
              </span>
            </div>
          </div>
        </div>

        {/* Core Definition */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-primary rounded-full" />
            {t("vocabulary.learning.coreDefinition")}
          </h3>
          <div className="pl-3 space-y-1">
            <p className="text-text-primary">
              <span className="text-text-secondary font-medium mr-2">
                {word.partOfSpeech}
              </span>
              {word.definition}
            </p>
            <p className="text-text-secondary text-sm">
              <span className="text-text-tertiary font-medium mr-2">
                {word.partOfSpeech}
              </span>
              {word.definitionCn}
            </p>
          </div>
        </div>

        {/* Authentic Context */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-primary rounded-full" />
            {t("vocabulary.learning.authenticContext")}
          </h3>
          <div className="space-y-4 pl-3">
            {word.contexts.map((context, index) => (
              <motion.div
                key={index}
                className="border-l-2 border-neutral-border pl-4 py-1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-center gap-2 text-xs text-text-tertiary mb-1.5">
                  <SourceIcon type={context.sourceType} />
                  <span>{context.source}</span>
                </div>
                <p className="text-text-primary text-sm leading-relaxed italic">
                  {context.text}
                </p>
                <p className="text-text-secondary text-xs mt-1">
                  {context.translation}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Side panel with etymology, synonyms, antonyms
 */
function WordInfoPanel({ word }: { word: WordData }) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      {/* Etymology */}
      <Card className="bg-neutral-background border border-neutral-border">
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-violet-500 rounded-full" />
            {t("vocabulary.learning.etymology")}
          </h3>
          <div className="text-sm space-y-1">
            <p className="text-text-primary font-medium">{word.etymology.breakdown}</p>
            <p className="text-text-secondary">{word.etymology.meaning}</p>
          </div>
        </CardContent>
      </Card>

      {/* Synonyms */}
      <Card className="bg-neutral-background border border-neutral-border">
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-blue-500 rounded-full" />
            {t("vocabulary.learning.synonyms")}
          </h3>
          <ul className="space-y-1">
            {word.synonyms.map((syn, i) => (
              <li key={i} className="text-sm text-text-secondary flex items-center gap-2">
                <span className="text-text-tertiary">-</span>
                {syn}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Antonyms */}
      <Card className="bg-neutral-background border border-neutral-border">
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span className="w-1 h-4 bg-orange-500 rounded-full" />
            {t("vocabulary.learning.antonyms")}
          </h3>
          <ul className="space-y-1">
            {word.antonyms.map((ant, i) => (
              <li key={i} className="text-sm text-text-secondary flex items-center gap-2">
                <span className="text-text-tertiary">-</span>
                {ant}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Main VocabularyLearning page component
 */
export function VocabularyLearning() {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [currentWord] = useState(mockCurrentWord)
  const session = mockSessionData

  const handleBack = () => {
    navigation.navigate(`/vocabulary/${session.bookId}`)
  }

  const handleGrade = (_grade: "forgot" | "hard" | "good" | "easy") => {
    // TODO: Will implement spaced repetition logic later
  }

  const handleNavigate = (itemId: string) => {
    navigation.navigate(`/${itemId}`)
  }

  const progressPercent = (session.currentIndex / session.totalWords) * 100

  return (
    <MainLayout activeNav="vocabulary" onNavigate={handleNavigate}>
      <motion.div
        className="max-w-6xl mx-auto flex flex-col gap-4"
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
      >
        {/* Header with Back Button and Progress */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">
                {session.bookName}
              </h1>
              <p className="text-sm text-text-secondary">
                {t("vocabulary.learning.progress", {
                  current: session.currentIndex,
                  total: session.totalWords
                })}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-3 flex-1 max-w-xs">
            <Progress value={progressPercent} className="h-2" animated />
            <span className="text-sm text-text-secondary whitespace-nowrap">
              {Math.round(progressPercent)}%
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - Word Card */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentWord.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <WordCard word={currentWord} />
              </motion.div>
            </AnimatePresence>

            {/* YouGlish Video Player */}
            <VideoPlayerPlaceholder />

            {/* Spaced Repetition Grading */}
            <SpacedRepetitionGrading onGrade={handleGrade} />
          </div>

          {/* Right Column - Word Info */}
          <div>
            <WordInfoPanel word={currentWord} />
          </div>
        </div>
      </motion.div>
    </MainLayout>
  )
}

export default VocabularyLearning

