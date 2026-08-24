import { z } from "zod";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const looseUuid = z.string().regex(uuidRegex, "Invalid UUID format.");

// --- GET /api/v1/topics/{id} ---
export const getTopicDetailParamsSchema = z.object({
    id: looseUuid,
});

export const getTopicDetailResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        id: looseUuid,
        lesson_id: looseUuid.nullable(),
        title: z.string().nullable(),
        description: z.string().nullable(),
        image: z.string().nullable(),
        vocabularies: z.array(z.object({
            id: looseUuid,
            kanji: z.string().nullable(),
            hiragana: z.string().nullable(),
            romaji: z.string().nullable(),
            word_type: z.string().nullable(),
            jlpt: z.string().nullable(),
            meaning: z.string().nullable(),
            is_favorited: z.boolean(),
            learning_status: z.string(),
        })),
        grammar_points: z.array(z.object({
            id: looseUuid,
            title_jp: z.string(),
            structure: z.string().nullable(),
            meaning_vi: z.string(),
            explanation: z.string().nullable(),
            usage: z.string().nullable(),
            jlpt_level: z.string(),
        })),
    }),
});

// --- POST /api/v1/admin/topics ---
export const createTopicBodySchema = z.object({
    lesson_id: looseUuid,
    title: z.string().trim().min(3, "title must be between 3 and 255 characters.").max(255, "title must be between 3 and 255 characters."),
    description: z.string().max(1000, "description must not exceed 1000 characters.").optional(),
    image: z.string().url("image must be a valid URL.").max(500, "image must not exceed 500 characters.").optional().or(z.literal("")),
    order_no: z.number().int().nonnegative("order_no must be a non-negative integer.").optional(),
});

export const createTopicResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        id: looseUuid,
        lesson_id: looseUuid.nullable(),
        title: z.string().nullable(),
        order_no: z.number().nullable(),
    }),
    message: z.string(),
});

// --- PUT /api/v1/admin/topics/{id} ---
export const updateTopicParamsSchema = z.object({
    id: looseUuid,
});

export const updateTopicBodySchema = z.object({
    lesson_id: looseUuid.optional(),
    title: z.string().trim().min(3, "title must be between 3 and 255 characters.").max(255, "title must be between 3 and 255 characters.").optional(),
    description: z.string().max(1000, "description must not exceed 1000 characters.").optional(),
    image: z.string().url("image must be a valid URL.").max(500, "image must not exceed 500 characters.").optional().or(z.literal("")).optional(),
    order_no: z.number().int().nonnegative("order_no must be a non-negative integer.").optional(),
});

export const updateTopicResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        id: looseUuid,
        title: z.string().nullable(),
    }),
    message: z.string(),
});

// --- DELETE /api/v1/admin/topics/{id} ---
export const deleteTopicParamsSchema = z.object({
    id: looseUuid,
});

export const deleteTopicResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
});

// --- POST /api/v1/admin/topics/{id}/vocabularies ---
export const addVocabularyParamsSchema = z.object({
    id: looseUuid,
});

export const addVocabularyBodySchema = z.object({
    vocabulary_id: looseUuid,
});

export const addVocabularyResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
});

// --- DELETE /api/v1/admin/topics/{id}/vocabularies/{vocabularyId} ---
export const removeVocabularyParamsSchema = z.object({
    id: looseUuid,
    vocabularyId: looseUuid,
});

export const removeVocabularyResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
});
