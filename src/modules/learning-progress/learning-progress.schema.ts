import { z } from "zod";

// --- Shared ---
const learningStatusEnum = z.enum(["NEW", "LEARNING", "REVIEWING", "MASTERED"]);
const jlptLevelEnum = z.enum(["N5", "N4", "N3", "N2", "N1"]);

// --- GET /api/v1/learning-progress ---
export const getLearningProgressOverviewResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        by_status: z.record(learningStatusEnum, z.number()),
        by_jlpt: z.record(jlptLevelEnum, z.number()),
        total_started: z.number(),
        total_mastered: z.number(),
        platform_total_vocabulary: z.number(),
    }),
});

// --- GET /api/v1/learning-progress/due ---
export const getDueReviewQueueQuerySchema = z.object({
    jlpt: jlptLevelEnum.optional(),
    status: learningStatusEnum.optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
});

export const getDueReviewQueueResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(z.object({
        progress_id: z.string().uuid(),
        vocabulary_id: z.string().uuid().nullable(),
        user_vocabulary_id: z.string().uuid().nullable(),
        kanji: z.string().nullable(),
        hiragana: z.string().nullable(),
        meaning: z.string().nullable(),
        jlpt: jlptLevelEnum,
        status: learningStatusEnum,
        mastery: z.number(),
        correct_count: z.number(),
        wrong_count: z.number(),
        next_review: z.string().datetime(),
    })),
    meta: z.object({ total_due: z.number() }),
});

// --- POST /api/v1/learning-progress/review ---
export const submitVocabularyReviewBodySchema = z.object({
    vocabulary_id: z.string().uuid().optional(),
    user_vocabulary_id: z.string().uuid().optional(),
    correct: z.boolean(),
    duration: z.number().min(0).max(300).optional(),
}).refine(body => Boolean(body.vocabulary_id) !== Boolean(body.user_vocabulary_id), {
    message: "Provide exactly one vocabulary identifier.",
});

export const submitVocabularyReviewResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        vocabulary_id: z.string().uuid().optional(),
        user_vocabulary_id: z.string().uuid().optional(),
        correct: z.boolean(),
        new_status: learningStatusEnum,
        new_mastery: z.number(),
        next_review: z.string().datetime(),
    }),
    message: z.string(),
}).refine(response => Boolean(response.data.vocabulary_id) !== Boolean(response.data.user_vocabulary_id), {
    message: "Response must identify exactly one vocabulary source.",
});

// --- GET /api/v1/learning-progress/history ---
export const getReviewHistoryQuerySchema = z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO Date
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const getReviewHistoryResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        total: z.number(),
        correct: z.number(),
        wrong: z.number(),
    })),
});
