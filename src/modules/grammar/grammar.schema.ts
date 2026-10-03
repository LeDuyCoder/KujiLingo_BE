import { z } from "zod";

export const jlptLevelEnum = z.enum(["N5", "N4", "N3", "N2", "N1"]);

export const listGrammarQuerySchema = z.object({
    jlpt_level: jlptLevelEnum.optional(),
    topic_id: z.string().uuid("topic_id must be a valid UUID.").optional(),
    lesson_id: z.string().uuid("lesson_id must be a valid UUID.").optional(),
    search: z.string().max(100, "search query must be at most 100 characters.").optional(),
    page: z.coerce.number().int().min(1, "page must be at least 1.").default(1),
    limit: z.coerce.number().int().min(1, "limit must be at least 1.").max(100, "limit cannot exceed 100.").default(30),
});

export const grammarIdParamSchema = z.object({
    id: z.string().uuid("id must be a valid UUID."),
});

export const exampleSentenceSchema = z.object({
    jp: z.string().min(1, "jp is required.").max(500, "jp max 500 characters."),
    vi: z.string().min(1, "vi is required.").max(500, "vi max 500 characters."),
    audio_url: z.string().url("audio_url must be a valid URL.").optional().or(z.literal("")).nullable(),
});

export const createGrammarBodySchema = z.object({
    title_jp: z.string().min(1, "title_jp is required.").max(255, "title_jp max 255 characters."),
    structure: z.string().min(1, "structure is required.").max(500, "structure max 500 characters."),
    meaning_vi: z.string().min(1, "meaning_vi is required.").max(1000, "meaning_vi max 1000 characters."),
    explanation: z.string().max(5000, "explanation max 5000 characters.").optional(),
    jlpt_level: jlptLevelEnum,
    example_sentences: z.array(exampleSentenceSchema).optional(),
    audio_url: z.string().url("audio_url must be a valid URL.").optional().or(z.literal("")).nullable(),
    lesson_id: z.string().uuid("lesson_id must be a valid UUID.").optional().nullable(),
    topic_id: z.string().uuid("topic_id must be a valid UUID.").optional().nullable(),
});

export const updateGrammarBodySchema = z.object({
    title_jp: z.string().min(1).max(255).optional(),
    structure: z.string().min(1).max(500).optional(),
    meaning_vi: z.string().min(1).max(1000).optional(),
    explanation: z.string().max(5000).optional(),
    jlpt_level: jlptLevelEnum.optional(),
    example_sentences: z.array(exampleSentenceSchema).optional(),
    audio_url: z.string().url().optional().or(z.literal("")).nullable(),
    lesson_id: z.string().uuid().optional().nullable(),
    topic_id: z.string().uuid().optional().nullable(),
});
