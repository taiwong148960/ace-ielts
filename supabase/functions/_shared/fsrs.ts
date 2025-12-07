/**
 * FSRS (Free Spaced Repetition Scheduler) for Edge Functions
 * Simplified implementation for server-side use
 */
import { 
  DEFAULT_FSRS_PARAMS, 
  LEARNING_STEPS, 
  LEARNING_GRADUATION_STEPS,
  type FSRSState,
  type FSRSRating,
  type SchedulingResult
} from "./types.ts"

interface WordProgress {
  state: FSRSState
  difficulty: number
  stability: number
  learning_step: number
  is_learning_phase: boolean
  elapsed_days: number
  reps: number
  lapses: number
}

const params = DEFAULT_FSRS_PARAMS

function initDifficulty(rating: FSRSRating): number {
  const { w } = params
  return Math.max(1, Math.min(10, w[4] - (rating - 3) * w[5]))
}

function initStability(rating: FSRSRating): number {
  const { w } = params
  return Math.max(0.1, w[rating - 1])
}

function nextDifficulty(difficulty: number, rating: FSRSRating): number {
  const { w } = params
  const d0 = initDifficulty(rating)
  const newD = w[7] * d0 + (1 - w[7]) * difficulty
  const meanReversion = w[7] * (d0 - newD)
  return Math.max(1, Math.min(10, newD + meanReversion))
}

function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0
  return Math.pow(1 + elapsedDays / (9 * stability), -1)
}

function nextInterval(stability: number, retention: number = params.requestRetention): number {
  if (stability <= 0 || retention <= 0 || retention >= 1) return 1
  return Math.round(9 * stability * (1 / retention - 1))
}

function nextStabilitySuccess(
  difficulty: number,
  stability: number,
  r: number,
  rating: FSRSRating
): number {
  const { w } = params
  const hardPenalty = rating === 2 ? w[15] : 1
  const easyBonus = rating === 4 ? w[16] : 1

  const newS = stability * (
    Math.exp(w[8]) *
    (11 - difficulty) *
    Math.pow(stability, -w[9]) *
    (Math.exp(w[10] * (1 - r)) - 1) *
    hardPenalty *
    easyBonus + 1
  )

  return Math.max(0.1, Math.min(newS, params.maximumInterval))
}

function nextStabilityFailure(
  difficulty: number,
  stability: number,
  r: number
): number {
  const { w } = params
  const newS = w[11] *
    Math.pow(difficulty, -w[12]) *
    (Math.pow(stability + 1, w[13]) - 1) *
    Math.exp(w[14] * (1 - r))

  return Math.max(0.1, Math.min(newS, stability))
}

function fuzzInterval(interval: number): number {
  if (interval <= 2) return interval
  const fuzzFactor = 0.05
  const fuzzRange = Math.max(1, Math.round(interval * fuzzFactor))
  const fuzz = Math.floor(Math.random() * (2 * fuzzRange + 1)) - fuzzRange
  return Math.max(1, interval + fuzz)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function processReview(
  progress: WordProgress,
  rating: FSRSRating,
  now: Date = new Date()
): SchedulingResult {
  const { state, is_learning_phase } = progress

  if (is_learning_phase || state === "new" || state === "learning") {
    return reviewLearningPhase(progress, rating, now)
  }

  return reviewDayPhase(progress, rating, now)
}

function reviewLearningPhase(
  progress: WordProgress,
  rating: FSRSRating,
  now: Date
): SchedulingResult {
  const { learning_step } = progress
  const intervalMinutes = LEARNING_STEPS[rating]

  if (progress.state === "new") {
    const newDifficulty = initDifficulty(rating)
    const newStability = initStability(rating)

    if (rating === 1) {
      return {
        state: "learning",
        difficulty: newDifficulty,
        stability: newStability,
        retrievability: 1,
        elapsed_days: 0,
        scheduled_days: 0,
        due_at: new Date(now.getTime() + intervalMinutes * 60 * 1000),
        learning_step: 0,
        is_learning_phase: true
      }
    }

    if (rating === 4) {
      const interval = Math.max(1, nextInterval(newStability))
      return {
        state: "review",
        difficulty: newDifficulty,
        stability: newStability,
        retrievability: 1,
        elapsed_days: 0,
        scheduled_days: fuzzInterval(interval),
        due_at: addDays(now, fuzzInterval(interval)),
        learning_step: 0,
        is_learning_phase: false
      }
    }

    const nextStep = rating === 3 ? 1 : 0
    const shouldGraduate = nextStep >= LEARNING_GRADUATION_STEPS

    if (shouldGraduate) {
      const interval = Math.max(1, nextInterval(newStability))
      return {
        state: "review",
        difficulty: newDifficulty,
        stability: newStability,
        retrievability: 1,
        elapsed_days: 0,
        scheduled_days: fuzzInterval(interval),
        due_at: addDays(now, fuzzInterval(interval)),
        learning_step: 0,
        is_learning_phase: false
      }
    }

    return {
      state: "learning",
      difficulty: newDifficulty,
      stability: newStability,
      retrievability: 1,
      elapsed_days: 0,
      scheduled_days: 0,
      due_at: new Date(now.getTime() + intervalMinutes * 60 * 1000),
      learning_step: nextStep,
      is_learning_phase: true
    }
  }

  const currentDifficulty = progress.difficulty || initDifficulty(3)
  const currentStability = progress.stability || initStability(3)

  if (rating === 1) {
    return {
      state: "learning",
      difficulty: currentDifficulty,
      stability: Math.max(0.1, currentStability * 0.5),
      retrievability: 1,
      elapsed_days: 0,
      scheduled_days: 0,
      due_at: new Date(now.getTime() + intervalMinutes * 60 * 1000),
      learning_step: 0,
      is_learning_phase: true
    }
  }

  if (rating === 4) {
    const newStability = Math.max(currentStability * 1.5, 1)
    const interval = Math.max(1, nextInterval(newStability))
    return {
      state: "review",
      difficulty: nextDifficulty(currentDifficulty, rating),
      stability: newStability,
      retrievability: 1,
      elapsed_days: 0,
      scheduled_days: fuzzInterval(interval),
      due_at: addDays(now, fuzzInterval(interval)),
      learning_step: 0,
      is_learning_phase: false
    }
  }

  const stepIncrement = rating === 3 ? 1 : 0
  const nextStepVal = learning_step + stepIncrement
  const shouldGraduate = nextStepVal >= LEARNING_GRADUATION_STEPS

  if (shouldGraduate) {
    const interval = Math.max(1, nextInterval(currentStability))
    return {
      state: "review",
      difficulty: nextDifficulty(currentDifficulty, rating),
      stability: currentStability,
      retrievability: 1,
      elapsed_days: 0,
      scheduled_days: fuzzInterval(interval),
      due_at: addDays(now, fuzzInterval(interval)),
      learning_step: 0,
      is_learning_phase: false
    }
  }

  return {
    state: "learning",
    difficulty: currentDifficulty,
    stability: currentStability,
    retrievability: 1,
    elapsed_days: 0,
    scheduled_days: 0,
    due_at: new Date(now.getTime() + intervalMinutes * 60 * 1000),
    learning_step: nextStepVal,
    is_learning_phase: true
  }
}

function reviewDayPhase(
  progress: WordProgress,
  rating: FSRSRating,
  now: Date
): SchedulingResult {
  const { difficulty, stability, elapsed_days } = progress
  const r = retrievability(elapsed_days, stability)

  if (rating === 1) {
    const newStability = nextStabilityFailure(difficulty, stability, r)
    const intervalMinutes = LEARNING_STEPS[1]

    return {
      state: "relearning",
      difficulty: nextDifficulty(difficulty, rating),
      stability: newStability,
      retrievability: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      due_at: new Date(now.getTime() + intervalMinutes * 60 * 1000),
      learning_step: 0,
      is_learning_phase: true
    }
  }

  const newDifficulty = nextDifficulty(difficulty, rating)
  const newStability = nextStabilitySuccess(difficulty, stability, r, rating)
  const interval = Math.max(1, Math.min(nextInterval(newStability), params.maximumInterval))
  const fuzzedInterval = fuzzInterval(interval)

  return {
    state: "review",
    difficulty: newDifficulty,
    stability: newStability,
    retrievability: retrievability(0, newStability),
    elapsed_days: 0,
    scheduled_days: fuzzedInterval,
    due_at: addDays(now, fuzzedInterval),
    learning_step: 0,
    is_learning_phase: false
  }
}

export function createInitialWordProgress(
  userId: string,
  wordId: string,
  bookId: string
) {
  return {
    user_id: userId,
    word_id: wordId,
    book_id: bookId,
    state: "new",
    difficulty: 0,
    stability: 0,
    retrievability: 1,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    learning_step: 0,
    is_learning_phase: true,
    last_review_at: null,
    due_at: new Date().toISOString(),
    total_reviews: 0,
    correct_reviews: 0
  }
}
