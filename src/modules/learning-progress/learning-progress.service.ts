import { learningProgressRepository } from "./learning-progress.repository.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);

let platformVocabCountCached: number | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

async function getPlatformTotal(): Promise<number> {
    const now = Date.now();
    if (platformVocabCountCached === null || now - cacheTimestamp > CACHE_DURATION_MS) {
        platformVocabCountCached = await learningProgressRepository.countPlatformVocabularies();
        cacheTimestamp = now;
    }
    return platformVocabCountCached;
}

export const learningProgressService = {
    /**
     * Aggregate study statistics for a user
     */
    async getOverview(userId: string) {
        const progressItems = await learningProgressRepository.getOverviewData(userId);
        const platformTotal = await getPlatformTotal();

        const by_status = { NEW: 0, LEARNING: 0, REVIEWING: 0, MASTERED: 0 };
        const by_jlpt = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 };

        let total_started = 0;
        let total_mastered = 0;

        for (const item of progressItems) {
            if (item.status) {
                const statusStr = item.status as keyof typeof by_status;
                if (statusStr in by_status) {
                    by_status[statusStr]++;
                    total_started++;
                    if (statusStr === "MASTERED") {
                        total_mastered++;
                    }
                }
            }

            const jlpt = item.vocabularies?.jlpt;
            if (jlpt) {
                const jlptStr = jlpt as keyof typeof by_jlpt;
                if (jlptStr in by_jlpt) {
                    by_jlpt[jlptStr]++;
                }
            }
        }

        return {
            success: true,
            data: {
                by_status,
                by_jlpt,
                total_started,
                total_mastered,
                platform_total_vocabulary: platformTotal
            }
        };
    },

    /**
     * Retrieve the list of items due for review
     */
    async getDueQueue(userId: string, filters: { jlpt?: string; status?: string; limit: number }, language = "vi") {
        const allDue = await learningProgressRepository.findDue(userId, filters);
        const totalDue = await learningProgressRepository.countDue(userId, filters);

        // Sort items by status priority: LEARNING (1) > REVIEWING (2) > NEW (3) > MASTERED (4)
        const statusPriority: Record<string, number> = {
            LEARNING: 1,
            REVIEWING: 2,
            NEW: 3,
            MASTERED: 4
        };

        allDue.sort((a, b) => {
            const pA = statusPriority[a.status || "NEW"] || 5;
            const pB = statusPriority[b.status || "NEW"] || 5;
            if (pA !== pB) return pA - pB;

            const timeA = a.next_review ? new Date(a.next_review).getTime() : 0;
            const timeB = b.next_review ? new Date(b.next_review).getTime() : 0;
            return timeA - timeB; // Most overdue first (older next_review first)
        });

        const sliced = allDue.slice(0, filters.limit);

        const mappedData = sliced.map(item => {
            const meanings = item.vocabularies?.vocabulary_meanings || [];
            const meaning = meanings.find(m => m.language === language)?.meaning
                || meanings.find(m => m.language === "vi")?.meaning
                || meanings[0]?.meaning
                || null;

            return {
                progress_id: item.id,
                vocabulary_id: item.vocabulary_id || "",
                kanji: item.vocabularies?.kanji || null,
                hiragana: item.vocabularies?.hiragana || null,
                meaning,
                jlpt: (item.vocabularies?.jlpt || "N5") as any,
                status: (item.status || "NEW") as any,
                mastery: item.mastery ?? 0.0,
                correct_count: item.correct_count ?? 0,
                wrong_count: item.wrong_count ?? 0,
                next_review: item.next_review ? item.next_review.toISOString() : new Date().toISOString()
            };
        });

        return {
            success: true,
            data: mappedData,
            meta: {
                total_due: totalDue
            }
        };
    },

    /**
     * Submit review result and update learning progress using SM-2
     */
    async submitReview(userId: string, body: { vocabulary_id: string; correct: boolean; duration?: number }) {
        const { vocabulary_id, correct, duration } = body;

        // Verify if vocabulary exists
        const exists = await learningProgressRepository.checkVocabularyExists(vocabulary_id);
        if (!exists) {
            throw new Error("INVALID_VOCABULARY_REFERENCE");
        }

        // Get current progress
        const currentProgress = await learningProgressRepository.findProgress(userId, vocabulary_id);

        let correctCount = currentProgress?.correct_count ?? 0;
        let wrongCount = currentProgress?.wrong_count ?? 0;
        let mastery = currentProgress?.mastery ?? 0.0;
        const currentStatus = currentProgress?.status ?? "NEW";

        let newStatus = currentStatus;
        let newMastery = mastery;
        let nextReview = new Date();

        if (correct) {
            correctCount++;
            newMastery = Math.min(1.0, mastery + 0.15);
            newMastery = Math.round(newMastery * 100) / 100; // Floating point precision fix

            // Advance status thresholds
            if (newMastery >= 0.85) {
                newStatus = "MASTERED";
            } else if (newMastery >= 0.4) {
                newStatus = "REVIEWING";
            } else {
                newStatus = "LEARNING";
            }

            // Mastery scaling: higher mastery -> longer interval (from 1 day for LEARNING up to 30+ days for MASTERED)
            const intervalDays = Math.round(1 + Math.pow(newMastery, 2.5) * 30);
            nextReview = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
        } else {
            wrongCount++;
            newMastery = Math.max(0.0, mastery - 0.2);
            newMastery = Math.round(newMastery * 100) / 100; // Floating point precision fix

            // Regress status thresholds
            if (currentStatus === "MASTERED" && newMastery < 0.7) {
                newStatus = "REVIEWING";
            }
            if (newStatus === "REVIEWING" && newMastery < 0.3) {
                newStatus = "LEARNING";
            }
            if (currentStatus === "NEW") {
                newStatus = "LEARNING";
            }

            // Short intervals on wrong answers
            if (newStatus === "MASTERED") {
                nextReview = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour
            } else if (newStatus === "REVIEWING") {
                nextReview = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours
            } else {
                nextReview = new Date(); // immediate (now)
            }
        }

        const lastReview = new Date();

        const historyData: { correct: boolean; duration?: number } = { correct };
        if (duration !== undefined) {
            historyData.duration = duration;
        }

        const updatedProgress = await learningProgressRepository.saveReviewResult(
            userId,
            vocabulary_id,
            {
                status: newStatus as any,
                mastery: newMastery,
                correct_count: correctCount,
                wrong_count: wrongCount,
                last_review: lastReview,
                next_review: nextReview
            },
            historyData
        );

        return {
            success: true,
            data: {
                vocabulary_id: updatedProgress.vocabulary_id || "",
                correct,
                new_status: updatedProgress.status || "NEW",
                new_mastery: updatedProgress.mastery ?? 0.0,
                next_review: updatedProgress.next_review ? updatedProgress.next_review.toISOString() : nextReview.toISOString()
            },
            message: "Review recorded."
        };
    },

    /**
     * Get aggregated review stats for a date range, filled with zero gaps
     */
    async getHistory(userId: string, query: { start_date: string; end_date: string }) {
        const { start_date, end_date } = query;

        const start = dayjs.utc(start_date).startOf("day");
        const end = dayjs.utc(end_date).endOf("day");

        // Validate range <= 366 days
        const diffDays = end.diff(start, "day");
        if (diffDays > 366) {
            throw new Error("RANGE_TOO_LARGE");
        }

        const histories = await learningProgressRepository.getReviewHistory(userId, start.toDate(), end.toDate());

        const grouped: Record<string, { total: number; correct: number; wrong: number }> = {};

        // Pre-fill date range gaps using UTC
        let current = start;
        while (current.isBefore(end) || current.isSame(end, "day")) {
            const dateStr = current.format("YYYY-MM-DD");
            grouped[dateStr] = { total: 0, correct: 0, wrong: 0 };
            current = current.add(1, "day");
        }

        // Aggregate records in UTC
        for (const item of histories) {
            if (item.reviewed_at) {
                const dateStr = dayjs.utc(item.reviewed_at).format("YYYY-MM-DD");
                if (grouped[dateStr]) {
                    grouped[dateStr].total++;
                    if (item.correct) {
                        grouped[dateStr].correct++;
                    } else {
                        grouped[dateStr].wrong++;
                    }
                }
            }
        }

        const list = Object.entries(grouped).map(([date, counts]) => ({
            date,
            total: counts.total,
            correct: counts.correct,
            wrong: counts.wrong
        })).sort((a, b) => a.date.localeCompare(b.date));

        return {
            success: true,
            data: list
        };
    }
};
