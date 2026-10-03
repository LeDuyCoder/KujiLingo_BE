import { z } from "zod";

export const achievementCatalogQuerySchema = z.object({
    type: z.enum(["STREAK", "EXP", "VOCAB_MASTER", "QUIZ_PERFECT"]).optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
});

export const getMyAchievementsQuerySchema = z.object({
    type: z.enum(["STREAK", "EXP", "VOCAB_MASTER", "QUIZ_PERFECT"]).optional(),
    unlocked_only: z.coerce.boolean().default(false),
});

export const achievementIdParamSchema = z.object({
    achievementId: z.string(),
});

export const createAchievementBodySchema = z.object({
    title: z.string().min(1).max(255),
    description: z.string().min(1),
    icon: z.string().min(1),
    type: z.enum(["STREAK", "EXP", "VOCAB_MASTER", "QUIZ_PERFECT"]),
    condition_value: z.number().int().positive(),
    reward_exp: z.number().int().nonnegative().default(0),
});

export const updateAchievementBodySchema = z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().min(1).optional(),
    icon: z.string().min(1).optional(),
    reward_exp: z.number().int().nonnegative().optional(),
});

export const getMyShowcaseQuerySchema = z.object({
    limit: z.coerce.number().min(1).max(6).default(3).optional(),
});

export const userShowcaseParamSchema = z.object({
    userId: z.string(),
});

export const updateShowcaseBodySchema = z.object({
    achievement_id: z.string().optional(),
    slot: z.number().int().min(1).max(3).optional(),
    achievement_ids: z.array(z.string()).max(3).optional(),
});
