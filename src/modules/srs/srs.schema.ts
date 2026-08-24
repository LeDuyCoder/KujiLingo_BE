import { z } from "zod";

export const getDueCardsQuerySchema = z.object({
    item_type: z.enum(["vocabulary", "kanji", "grammar"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const getDueCardsResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(z.object({
        card_id: z.string().uuid(),
        item_type: z.enum(["vocabulary", "kanji", "grammar"]),
        item_id: z.string().uuid(),
        state: z.enum(["new", "learning", "review", "relearning"]),
        due_at: z.date().or(z.string()).or(z.any()),
        content: z.any(),
    })),
    meta: z.object({
        total_due: z.number(),
    }),
});

export const reviewBodySchema = z.object({
    rating: z.enum(["again", "hard", "good", "easy"]),
});

export const reviewResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        card_id: z.string().uuid(),
        rating: z.enum(["again", "hard", "good", "easy"]),
        new_interval_days: z.number(),
        new_due_at: z.date().or(z.string()).or(z.any()),
        new_state: z.string(),
        repetitions: z.number(),
    }),
    message: z.string(),
});

export const addItemBodySchema = z.object({
    item_type: z.enum(["vocabulary", "kanji", "grammar"]),
    item_id: z.string().uuid(),
});
