import { z } from "zod";

export const jlptLevelEnum = z.enum(["N5", "N4", "N3", "N2", "N1"]);

export const listKanjiQuerySchema = z.object({
    jlpt_level: jlptLevelEnum.optional(),
    radical: z.string().max(20, "radical must be at most 20 characters.").optional(),
    min_strokes: z.coerce.number().int().min(1, "min_strokes must be at least 1.").optional(),
    max_strokes: z.coerce.number().int().max(30, "max_strokes cannot exceed 30.").optional(),
    search: z.string().max(20, "search query must be at most 20 characters.").optional(),
    page: z.coerce.number().int().min(1, "page must be at least 1.").default(1),
    limit: z.coerce.number().int().min(1, "limit must be at least 1.").max(100, "limit cannot exceed 100.").default(50),
});

export const kanjiIdParamSchema = z.object({
    id: z.string().uuid("id must be a valid UUID."),
});

export const kanjiExampleSchema = z.object({
    word_jp: z.string().min(1, "word_jp is required."),
    reading: z.string().min(1, "reading is required."),
    meaning_vi: z.string().min(1, "meaning_vi is required."),
});

export const createKanjiBodySchema = z.object({
    character: z.string().length(1, "character must be exactly 1 CJK character."),
    meaning_vi: z.string().min(1, "meaning_vi is required.").max(500, "meaning_vi max 500 characters."),
    meaning_en: z.string().max(500, "meaning_en max 500 characters.").optional(),
    onyomi: z.string().max(255).optional(),
    kunyomi: z.string().max(255).optional(),
    stroke_count: z.number().int().min(1).max(30),
    jlpt_level: jlptLevelEnum,
    radical: z.string().max(20).optional(),
    stroke_order_image_url: z.string().url("stroke_order_image_url must be a valid URL.").optional(),
    examples: z.array(kanjiExampleSchema).optional(),
    lesson_id: z.string().uuid("lesson_id must be a valid UUID.").optional(),
});

export const updateKanjiBodySchema = z.object({
    character: z.string().length(1).optional(),
    meaning_vi: z.string().min(1).max(500).optional(),
    meaning_en: z.string().max(500).optional(),
    onyomi: z.string().max(255).optional(),
    kunyomi: z.string().max(255).optional(),
    stroke_count: z.number().int().min(1).max(30).optional(),
    jlpt_level: jlptLevelEnum.optional(),
    radical: z.string().max(20).optional(),
    stroke_order_image_url: z.string().url().optional(),
    examples: z.array(kanjiExampleSchema).optional(),
    lesson_id: z.string().uuid().optional(),
});
