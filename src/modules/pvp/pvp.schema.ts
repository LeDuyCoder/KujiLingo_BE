import { z } from "zod";

export const getMatchHistoryQuerySchema = z.object({
    result: z.enum(["WIN", "LOSS", "DRAW"]).optional(),
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20).optional(),
});

export const recordMatchBodySchema = z.object({
    user_id: z.string().uuid("user_id must be a valid UUID"),
    opponent_id: z.string().uuid("opponent_id must be a valid UUID"),
    winner_id: z.string().uuid("winner_id must be a valid UUID").nullable().optional(),
    user_score: z.number().int().min(0, "user_score must be non-negative").optional().default(0),
    opponent_score: z.number().int().min(0, "opponent_score must be non-negative").optional().default(0),
    rating_change_user: z.number().int().optional().default(0),
    rating_change_opponent: z.number().int().optional().default(0),
    played_at: z.string().datetime({ message: "played_at must be a valid ISO 8601 timestamp" }),
    external_match_id: z.string().optional(),
}).refine((data) => data.user_id !== data.opponent_id, {
    message: "user_id and opponent_id cannot be the same",
    path: ["opponent_id"],
}).refine((data) => {
    if (data.winner_id !== undefined && data.winner_id !== null) {
        return data.winner_id === data.user_id || data.winner_id === data.opponent_id;
    }
    return true;
}, {
    message: "winner_id must be user_id, opponent_id, or null",
    path: ["winner_id"],
});

export const getLeaderboardQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
});

export type GetMatchHistoryQueryInput = z.infer<typeof getMatchHistoryQuerySchema>;
export type RecordMatchBodyInput = z.infer<typeof recordMatchBodySchema>;
export type GetLeaderboardQueryInput = z.infer<typeof getLeaderboardQuerySchema>;
