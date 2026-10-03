import { z } from "zod";
import {
    achievementCatalogQuerySchema,
    getMyAchievementsQuerySchema,
    achievementIdParamSchema,
    createAchievementBodySchema,
    updateAchievementBodySchema,
    getMyShowcaseQuerySchema,
    userShowcaseParamSchema,
    updateShowcaseBodySchema,
} from "./achievements.schema.js";

export type GetCatalogQuery = z.infer<typeof achievementCatalogQuerySchema>;
export type GetMyAchievementsQuery = z.infer<typeof getMyAchievementsQuerySchema>;
export type GetAchievementParams = z.infer<typeof achievementIdParamSchema>;
export type CreateAchievementBody = z.infer<typeof createAchievementBodySchema>;
export type UpdateAchievementBody = z.infer<typeof updateAchievementBodySchema>;
export type GetMyShowcaseQuery = z.infer<typeof getMyShowcaseQuerySchema>;
export type UserShowcaseParam = z.infer<typeof userShowcaseParamSchema>;
export type UpdateShowcaseBody = z.infer<typeof updateShowcaseBodySchema>;

export interface AchievementCatalogItem {
    id: string;
    title: string;
    description: string;
    icon: string;
    type: "STREAK" | "EXP" | "VOCAB_MASTER" | "QUIZ_PERFECT";
    condition_value: number;
    reward_exp: number;
    is_unlocked: boolean;
    unlocked_at: string | null;
    current_value: number;
    progress_percent: number;
}
