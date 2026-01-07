import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTodayLearningSession,
  processWordReview,
} from "../services/vocabulary-detail";
import { SpacedRepetitionGrade, WordWithProgress } from "../types/vocabulary";
import { createLogger } from "../utils/logger";

const logger = createLogger("useVocabularyLearning");

export function useVocabularyLearning(
  bookId: string | null,
  userId: string | null,
) {
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<WordWithProgress[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [results, setResults] = useState<Record<string, SpacedRepetitionGrade>>(
    {},
  );

  const enabled = !!bookId && !!userId;

  // Fetch session
  const { data: sessionData, isLoading, error } = useQuery({
    queryKey: ["vocabulary", "session", bookId, userId],
    queryFn: async () => {
      if (!bookId || !userId) return null;
      const data = await getTodayLearningSession(bookId, userId);
      return data;
    },
    enabled,
    staleTime: 0, // Always fresh for learning session
    gcTime: 0, // Don't cache the session queue too long
  });

  // Initialize queue when data arrives
  useEffect(() => {
    if (sessionData) {
      // Combine review words and new words
      // Simple strategy: Review first, then New
      const combined = [...sessionData.reviewWords, ...sessionData.newWords];
      setQueue(combined);
      setCurrentIndex(0);
      setSessionCompleted(combined.length === 0);
    }
  }, [sessionData]);

  // Submit grade mutation
  const submitGradeMutation = useMutation({
    mutationFn: async (
      { wordId, grade }: { wordId: string; grade: SpacedRepetitionGrade },
    ) => {
      if (!userId || !bookId) throw new Error("Missing user or book ID");
      return await processWordReview(userId, wordId, bookId, grade);
    },
    onSuccess: (_data, variables) => {
      logger.debug("Grade submitted", variables);
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ["vocabulary", "book-detail", bookId],
      });
    },
    onError: (err) => {
      logger.error("Failed to submit grade", { error: err.message });
    },
  });

  const currentWord = useMemo(() => {
    if (queue.length === 0 || currentIndex >= queue.length) return null;
    return queue[currentIndex];
  }, [queue, currentIndex]);

  const submitGrade = useCallback(async (grade: SpacedRepetitionGrade) => {
    if (!currentWord || !userId || !bookId) return;

    // Optimistic update / Queue management
    const word = currentWord;
    setResults((prev) => ({ ...prev, [word.id]: grade }));

    // Trigger background API call
    submitGradeMutation.mutate({ wordId: word.id, grade });

    // Logic for queue movement
    if (grade === "forgot") {
      // If forgot, requeue at the end of the session
      // clone the word to avoid reference issues
      const requeuedWord = { ...word };
      setQueue((prev) => {
        const newQueue = [...prev];
        // Move current index forward? No, we usually just append and move forward
        newQueue.push(requeuedWord);
        return newQueue;
      });
      // Move to next word
      setCurrentIndex((prev) => prev + 1);
    } else {
      // For other grades, just move to next
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= queue.length) {
          setSessionCompleted(true);
        }
        return next;
      });
    }
  }, [currentWord, userId, bookId, queue.length, submitGradeMutation]);

  const totalWords = useMemo(() => {
    // Initial length before requeues?
    // Or current queue length?
    // Let's use sessionData for initial total
    return (sessionData?.reviewWords.length || 0) +
      (sessionData?.newWords.length || 0);
  }, [sessionData]);

  // Progress percentage (based on unique words completed vs total unique words in session)
  const progress = useMemo(() => {
    if (totalWords === 0) return 0;
    // Simple progress: currentIndex / queue.length might be misleading if we add words
    // Better: Number of unique words graded / Total unique words
    const gradedCount = Object.keys(results).length;
    return Math.min(100, Math.round((gradedCount / totalWords) * 100));
  }, [results, totalWords]);

  return {
    currentWord,
    isLoading,
    error,
    progress,
    totalWords,
    currentIndex,
    sessionCompleted,
    submitGrade,
    isSubmitting: submitGradeMutation.isPending,
  };
}
