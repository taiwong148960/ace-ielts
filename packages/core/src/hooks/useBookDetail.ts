/**
 * useBookDetail Hook
 * TanStack Query based hook for vocabulary book detail page data
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBookWithDetails,
  getDifficultWords,
  getForgettingCurveStats,
  getRecentWords,
  getTodayLearningSession,
  initializeBookProgress,
} from "../services/vocabulary-detail";
import { stateToMasteryLevel } from "../services/fsrs";
import { queryKeys } from "../query";
import { createLogger } from "../utils/logger";
import type {
  BookDetailStats,
  ForgettingCurveStats,
  TodayLearningSession,
  UserBookProgress,
  VocabularyBook,
  WordWithProgress,
} from "../types/vocabulary";

/**
 * Book detail page data
 */
export interface BookDetailData {
  book: VocabularyBook | null;
  progress: UserBookProgress | null;
  stats: BookDetailStats | null;
  recentWords: WordWithProgress[];
  difficultWords: WordWithProgress[];
  todaySession: TodayLearningSession | null;
  forgettingCurveStats: ForgettingCurveStats | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook return type
 */
export interface UseBookDetailReturn extends BookDetailData {
  refetch: () => Promise<void>;
  initializeProgress: () => Promise<void>;
}

/**
 * Hook for managing vocabulary book detail page data
 */
export function useBookDetail(
  bookId: string | null,
  userId: string | null,
): UseBookDetailReturn {
  const queryClient = useQueryClient();
  const logger = createLogger("useBookDetail");
  const enabled = !!bookId && !!userId;

  // Main query for book details (book, progress, stats)
  const bookDetailQuery = useQuery({
    queryKey: queryKeys.bookDetail.byId(bookId || "", userId || ""),
    queryFn: async () => {
      const data = await getBookWithDetails(bookId!, userId!);
      if (!data) {
        throw new Error("Book not found");
      }
      return data;
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Query for recent words
  const recentWordsQuery = useQuery({
    queryKey: queryKeys.bookDetail.recentWords(bookId || "", userId || ""),
    queryFn: () => getRecentWords(bookId!, userId!, 5),
    enabled,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  // Query for difficult words
  const difficultWordsQuery = useQuery({
    queryKey: queryKeys.bookDetail.difficultWords(bookId || "", userId || ""),
    queryFn: () => getDifficultWords(bookId!, userId!, 5),
    enabled,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  // Query for today's learning session
  const todaySessionQuery = useQuery({
    queryKey: queryKeys.bookDetail.todaySession(bookId || "", userId || ""),
    queryFn: () => getTodayLearningSession(bookId!, userId!),
    enabled,
    staleTime: 30 * 1000, // 30 seconds - more frequently updated
  });

  // Query for forgetting curve statistics
  const forgettingCurveQuery = useQuery({
    queryKey: queryKeys.bookDetail.forgettingCurve(bookId || "", userId || ""),
    queryFn: () => getForgettingCurveStats(bookId!, userId!),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - stats don't change frequently
  });

  /**
   * Refetch all book detail data
   */
  const refetch = async () => {
    await Promise.all([
      bookDetailQuery.refetch(),
      recentWordsQuery.refetch(),
      difficultWordsQuery.refetch(),
      todaySessionQuery.refetch(),
      forgettingCurveQuery.refetch(),
    ]);
  };

  /**
   * Initialize book progress if not exists
   */
  const initializeProgressFn = async () => {
    if (!bookId || !userId) return;

    try {
      const newProgress = await initializeBookProgress(userId, bookId);
      if (newProgress) {
        // Update the cache with the new progress
        queryClient.setQueryData(
          queryKeys.bookDetail.byId(bookId, userId),
          (
            old: {
              book: VocabularyBook;
              progress: UserBookProgress | null;
              stats: BookDetailStats;
            } | undefined,
          ) => {
            if (!old) return old;

            // Recalculate stats based on new progress
            const newStats: BookDetailStats = {
              totalWords: old.book.word_count || 0,
              mastered: newProgress.mastered_count || 0,
              learning: newProgress.learning_count || 0,
              newWords: newProgress.new_count || 0,
              todayReview: newProgress.reviews_today || 0,
              todayNew: newProgress.new_words_today || 0,
              estimatedMinutes: 0,
              streak: newProgress.streak_days || 0,
              accuracy: newProgress.accuracy_percent || 0,
              averageStability: 0,
            };

            return { ...old, progress: newProgress, stats: newStats };
          },
        );
      }
    } catch (err) {
      logger.error(
        "Error initializing progress",
        { bookId, userId },
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  };

  // Determine overall error message
  const error = bookDetailQuery.error
    ? bookDetailQuery.error instanceof Error
      ? bookDetailQuery.error.message
      : "Failed to load book details"
    : null;

  return {
    book: bookDetailQuery.data?.book ?? null,
    progress: bookDetailQuery.data?.progress ?? null,
    stats: bookDetailQuery.data?.stats ?? null,
    recentWords: recentWordsQuery.data ?? [],
    difficultWords: difficultWordsQuery.data ?? [],
    todaySession: todaySessionQuery.data ?? null,
    forgettingCurveStats: forgettingCurveQuery.data ?? null,
    isLoading: bookDetailQuery.isLoading || recentWordsQuery.isLoading ||
      difficultWordsQuery.isLoading || todaySessionQuery.isLoading,
    error,
    refetch,
    initializeProgress: initializeProgressFn,
  };
}

/**
 * Invalidate book detail cache
 * Call this after reviewing words or making changes
 */
export function useInvalidateBookDetail() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.bookDetail.all }),
    invalidateBook: (bookId: string, userId: string) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookDetail.byId(bookId, userId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookDetail.recentWords(bookId, userId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookDetail.difficultWords(bookId, userId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookDetail.todaySession(bookId, userId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookDetail.forgettingCurve(bookId, userId),
      });
    },
    invalidateTodaySession: (bookId: string, userId: string) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookDetail.todaySession(bookId, userId),
      }),
    invalidateForgettingCurve: (bookId: string, userId: string) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookDetail.forgettingCurve(bookId, userId),
      }),
  };
}

/**
 * Convert WordWithProgress to display format
 */
export function formatWordForDisplay(word: WordWithProgress): {
  id: string;
  word: string;
  mastery: "new" | "learning" | "mastered";
  lastReviewed: string | null;
  nextReview: string | null;
} {
  const mastery = stateToMasteryLevel(word.state, word.stability);

  return {
    id: word.id,
    word: word.word,
    mastery,
    lastReviewed: word.last_review_at
      ? formatRelativeTime(word.last_review_at)
      : null,
    nextReview: word.due_at ? formatRelativeTime(word.due_at, true) : null,
  };
}

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(
  timestamp: string,
  isFuture: boolean = false,
): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = isFuture
    ? date.getTime() - now.getTime()
    : now.getTime() - date.getTime();

  if (diffMs < 0 && isFuture) return "now";

  const diffMinutes = Math.abs(Math.round(diffMs / 60000));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ${isFuture ? "" : "ago"}`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ${isFuture ? "" : "ago"}`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return isFuture ? "tomorrow" : "yesterday";
  if (diffDays < 7) return `${diffDays}d ${isFuture ? "" : "ago"}`;

  const diffWeeks = Math.round(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ${isFuture ? "" : "ago"}`;

  const diffMonths = Math.round(diffDays / 30);
  return `${diffMonths}mo ${isFuture ? "" : "ago"}`;
}

export default useBookDetail;
