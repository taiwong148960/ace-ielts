/**
 * Vocabulary Learning Page
 * Word card learning interface with FSRS spaced repetition grading
 * Integrated with real backend data via useVocabularyLearning hook
 */

import { useMemo, useState, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Loader2,
  Maximize2,
  Newspaper,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Tv,
  Volume2,
  PartyPopper
} from "lucide-react"
import {
  cn,
  useNavigation,
  useTranslation,
  useAuth,
  useVocabularyLearning,
  getSupabase,
  type WordWithProgress,
  type SpacedRepetitionGrade
} from "@ace-ielts/core"

import { MainLayout } from "../../layout"
import {
  Card,
  CardContent,
  Button,
  Progress,
  fadeInUp
} from "../../components"

/**
 * Source icon component for example sentences
 */
function SourceIcon({ type }: { type: string }) {
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
 * Get audio URL from storage path
 */
const AUDIO_BUCKET = "vocabulary-audio"

function getAudioUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const supabase = getSupabase()
  const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Audio player component for YouGlish-style video (placeholder)
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
  onGrade,
  isSubmitting
}: {
  onGrade: (grade: SpacedRepetitionGrade) => void
  isSubmitting: boolean
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
              disabled={isSubmitting}
              className={cn(
                "py-3 px-4 rounded-lg font-medium transition-all",
                btn.color,
                isSubmitting && "opacity-50 cursor-not-allowed"
              )}
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
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
 * Word card component - displays real word data
 */
function WordCard({ 
  word,
  playingAudioId,
  onPlayAudio
}: { 
  word: WordWithProgress
  playingAudioId: string | null
  onPlayAudio: (audioId: string, audioUrl: string) => void
}) {
  const { t } = useTranslation()
  
  // Get the first definition for display
  const primaryDefinition = word.definitions?.[0]
  const partOfSpeech = primaryDefinition?.partOfSpeech || ""
  const meaning = primaryDefinition?.meaning || word.definition || ""
  const translation = primaryDefinition?.translation || ""
  
  // Get examples for display
  const examples = word.examples || []

  const wordAudioId = `word-${word.id}`
  const isWordPlaying = playingAudioId === wordAudioId

  const wordAudioUrl = getAudioUrl(word.word_audio_path)

  const handlePlayWordAudio = () => {
    if (wordAudioUrl) {
      onPlayAudio(wordAudioId, wordAudioUrl)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6 pb-4">
        {/* Word Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-text-primary tracking-tight uppercase">
                {word.word}
              </h1>
              <motion.button
                className={cn(
                  "p-2 rounded-full transition-colors",
                  isWordPlaying
                    ? "bg-primary text-white"
                    : "bg-neutral-background hover:bg-accent-blue text-text-secondary hover:text-primary",
                  !wordAudioUrl && "opacity-50 cursor-not-allowed"
                )}
                whileHover={{ scale: wordAudioUrl ? 1.1 : 1 }}
                whileTap={{ scale: wordAudioUrl ? 0.9 : 1 }}
                onClick={handlePlayWordAudio}
                disabled={!wordAudioUrl}
              >
                <Volume2 className="h-5 w-5" />
              </motion.button>
              {word.phonetic && (
                <span className="text-text-secondary font-mono text-lg">
                  {word.phonetic}
                </span>
              )}
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
              {partOfSpeech && (
                <span className="text-text-secondary font-medium mr-2">
                  {partOfSpeech}
                </span>
              )}
              {meaning}
            </p>
            {translation && (
              <p className="text-text-secondary text-sm">
                {translation}
              </p>
            )}
          </div>
        </div>

        {/* Authentic Context - Example Sentences */}
        {examples.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-primary rounded-full" />
              {t("vocabulary.learning.authenticContext")}
            </h3>
            <div className="space-y-4 pl-3">
              {examples.slice(0, 3).map((example, index) => {
                const exampleAudioUrl = getAudioUrl(example.audio_path)
                const exampleAudioId = `example-${word.id}-${index}`
                const isExamplePlaying = playingAudioId === exampleAudioId
                
                const handlePlayExampleAudio = () => {
                  if (exampleAudioUrl) {
                    onPlayAudio(exampleAudioId, exampleAudioUrl)
                  }
                }

                return (
                  <motion.div
                    key={index}
                    className="border-l-2 border-neutral-border pl-4 py-1"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    {example.source && (
                      <div className="flex items-center gap-2 text-xs text-text-tertiary mb-1.5">
                        <SourceIcon type={example.source.toLowerCase().includes("news") ? "news" : example.source.toLowerCase().includes("friends") || example.source.toLowerCase().includes("movie") ? "media" : "book"} />
                        <span>{example.source}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <p className="text-text-primary text-sm leading-relaxed italic flex-1">
                        {`"${example.sentence}"`}
                      </p>
                      {exampleAudioUrl && (
                        <motion.button
                          className={cn(
                            "p-1.5 rounded-full transition-colors shrink-0",
                            isExamplePlaying 
                              ? "bg-primary text-white" 
                              : "bg-neutral-background hover:bg-accent-blue text-text-secondary hover:text-primary"
                          )}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={handlePlayExampleAudio}
                        >
                          <Volume2 className="h-4 w-4" />
                        </motion.button>
                      )}
                    </div>
                    {example.translation && (
                      <p className="text-text-secondary text-xs mt-1">
                        {example.translation}
                      </p>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Side panel with synonyms and antonyms
 */
function WordInfoPanel({ word }: { word: WordWithProgress }) {
  const { t } = useTranslation()
  
  const synonyms = word.synonyms || []
  const antonyms = word.antonyms || []
  const collocations = word.collocations || []

  return (
    <div className="space-y-4">
      {/* Synonyms */}
      {synonyms.length > 0 && (
        <Card className="bg-neutral-background border border-neutral-border">
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-500 rounded-full" />
              {t("vocabulary.learning.synonyms")}
            </h3>
            <ul className="space-y-1">
              {synonyms.map((syn, i) => (
                <li key={i} className="text-sm text-text-secondary flex items-center gap-2">
                  <span className="text-text-tertiary">-</span>
                  {syn}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Antonyms */}
      {antonyms.length > 0 && (
        <Card className="bg-neutral-background border border-neutral-border">
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-orange-500 rounded-full" />
              {t("vocabulary.learning.antonyms")}
            </h3>
            <ul className="space-y-1">
              {antonyms.map((ant, i) => (
                <li key={i} className="text-sm text-text-secondary flex items-center gap-2">
                  <span className="text-text-tertiary">-</span>
                  {ant}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Collocations */}
      {collocations.length > 0 && (
        <Card className="bg-neutral-background border border-neutral-border">
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-violet-500 rounded-full" />
              {t("vocabulary.learning.collocations")}
            </h3>
            <ul className="space-y-1">
              {collocations.map((col, i) => (
                <li key={i} className="text-sm text-text-secondary flex items-center gap-2">
                  <span className="text-text-tertiary">-</span>
                  {col}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Topic Tag */}
      {word.topic && (
        <Card className="bg-neutral-background border border-neutral-border">
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-emerald-500 rounded-full" />
              {t("vocabulary.learning.topic")}
            </h3>
            <div className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
              {word.topic}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * Session completed component
 */
function SessionCompleted({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-20 gap-6"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        animate={{ rotate: [0, 10, -10, 0] }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <PartyPopper className="h-16 w-16 text-primary" />
      </motion.div>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          {t("vocabulary.learning.sessionComplete")}
        </h2>
        <p className="text-text-secondary">
          {t("vocabulary.learning.sessionCompleteDesc")}
        </p>
      </div>
      <Button onClick={onBack} className="gap-2">
        <CheckCircle2 className="h-4 w-4" />
        {t("vocabulary.learning.backToBook")}
      </Button>
    </motion.div>
  )
}

/**
 * Loading state component
 */
function LoadingState() {
  const { t } = useTranslation()
  
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="h-12 w-12 text-primary animate-spin" />
      <p className="text-text-secondary">{t("vocabulary.learning.loading")}</p>
    </div>
  )
}

/**
 * Empty session state component
 */
function EmptySession({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <CheckCircle2 className="h-12 w-12 text-emerald-500" />
      <div className="text-center">
        <h2 className="text-xl font-bold text-text-primary mb-2">
          {t("vocabulary.learning.noWordsToReview")}
        </h2>
        <p className="text-text-secondary">
          {t("vocabulary.learning.noWordsToReviewDesc")}
        </p>
      </div>
      <Button onClick={onBack} variant="outline">
        {t("vocabulary.learning.backToBook")}
      </Button>
    </div>
  )
}

/**
 * Main VocabularyLearning page component
 */
export function VocabularyLearning() {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const { user, isLoading: isAuthLoading } = useAuth()

  // Audio playback state - only one audio can play at a time
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Extract bookId from URL - route pattern: /vocabulary/:bookId/learn
  const bookId = useMemo(() => {
    const path = navigation.getCurrentPath()
    const match = path.match(/\/vocabulary\/([^/]+)\/learn/)
    return match ? match[1] : null
  }, [navigation])

  // Use the learning hook to manage session
  const {
    currentWord,
    isLoading,
    error,
    progress,
    totalWords,
    currentIndex,
    sessionCompleted,
    submitGrade,
    isSubmitting
  } = useVocabularyLearning(bookId, user?.id ?? null)

  // Handle audio playback - stop any currently playing audio before starting new one
  const handlePlayAudio = useCallback((audioId: string, audioUrl: string) => {
    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }

    // If clicking the same audio that's playing, just stop it
    if (playingAudioId === audioId) {
      setPlayingAudioId(null)
      audioRef.current = null
      return
    }

    // Create and play new audio
    const audio = new Audio(audioUrl)
    audioRef.current = audio
    setPlayingAudioId(audioId)

    audio.play().catch((err) => {
      console.error("Failed to play audio:", err)
      setPlayingAudioId(null)
    })

    // Reset state when audio ends
    audio.onended = () => {
      setPlayingAudioId(null)
      audioRef.current = null
    }

    // Reset state if audio errors
    audio.onerror = () => {
      setPlayingAudioId(null)
      audioRef.current = null
    }
  }, [playingAudioId])

  const handleBack = () => {
    // Stop audio when leaving
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (bookId) {
      navigation.navigate(`/vocabulary/${bookId}`)
    } else {
      navigation.navigate("/vocabulary")
    }
  }

  const handleGrade = (grade: SpacedRepetitionGrade) => {
    // Stop audio when grading
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setPlayingAudioId(null)
    }
    submitGrade(grade)
  }

  const handleNavigate = (itemId: string) => {
    navigation.navigate(`/${itemId}`)
  }

  // Loading state
  if (isLoading || isAuthLoading) {
    return (
      <MainLayout activeNav="vocabulary" onNavigate={handleNavigate}>
        <LoadingState />
      </MainLayout>
    )
  }

  // Error state
  if (error) {
    return (
      <MainLayout activeNav="vocabulary" onNavigate={handleNavigate}>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-red-500">{error.message}</p>
          <Button onClick={handleBack} variant="outline">
            {t("vocabulary.learning.backToBook")}
          </Button>
        </div>
      </MainLayout>
    )
  }

  // Session completed state
  if (sessionCompleted) {
    return (
      <MainLayout activeNav="vocabulary" onNavigate={handleNavigate}>
        <SessionCompleted onBack={handleBack} />
      </MainLayout>
    )
  }

  // No words to review
  if (!currentWord && totalWords === 0) {
    return (
      <MainLayout activeNav="vocabulary" onNavigate={handleNavigate}>
        <EmptySession onBack={handleBack} />
      </MainLayout>
    )
  }

  // Waiting for next word (shouldn't happen but safety check)
  if (!currentWord) {
    return (
      <MainLayout activeNav="vocabulary" onNavigate={handleNavigate}>
        <LoadingState />
      </MainLayout>
    )
  }

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
                {t("vocabulary.learning.title")}
              </h1>
              <p className="text-sm text-text-secondary">
                {t("vocabulary.learning.progress", {
                  current: currentIndex + 1,
                  total: totalWords
                })}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center gap-3 flex-1 max-w-xs">
            <Progress value={progress} className="h-2" animated />
            <span className="text-sm text-text-secondary whitespace-nowrap">
              {Math.round(progress)}%
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
                <WordCard 
                  word={currentWord} 
                  playingAudioId={playingAudioId}
                  onPlayAudio={handlePlayAudio}
                />
              </motion.div>
            </AnimatePresence>

            {/* YouGlish Video Player */}
            <VideoPlayerPlaceholder />

            {/* Spaced Repetition Grading */}
            <SpacedRepetitionGrading 
              onGrade={handleGrade} 
              isSubmitting={isSubmitting}
            />
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
