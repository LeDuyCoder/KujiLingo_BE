import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { authGuard } from "../../common/middlewares/auth.guard.js";
import { internalKeyGuard } from "../../common/middlewares/internal-key.guard.js";
import { pvpController } from "./pvp.controller.js";
import {
    getMatchHistoryQuerySchema,
    recordMatchBodySchema,
    getLeaderboardQuerySchema,
} from "./pvp.schema.js";

export async function pvpRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    // 1. Get My PVP Statistics
    router.get(
        "/api/v1/pvp/statistics",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["PVP"],
                summary: "Get My PVP Statistics",
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            total_matches: z.number(),
                            wins: z.number(),
                            losses: z.number(),
                            draws: z.number(),
                            win_rate: z.number().nullable(),
                            rating: z.number(),
                            highest_rating: z.number(),
                        }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.string(),
                            message: z.string(),
                        }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.string(),
                            message: z.string(),
                        }),
                    }),
                },
            },
        },
        pvpController.getMyStatistics
    );

    // 2. Get Match History
    router.get(
        "/api/v1/pvp/history",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["PVP"],
                summary: "Get Match History",
                querystring: getMatchHistoryQuerySchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.array(
                            z.object({
                                id: z.string(),
                                opponent_id: z.string(),
                                opponent_name: z.string(),
                                opponent_avatar: z.string().nullable(),
                                result: z.enum(["WIN", "LOSS", "DRAW"]),
                                score: z.object({
                                    player: z.number(),
                                    opponent: z.number(),
                                }),
                                rating_change: z.number(),
                                played_at: z.string(),
                            })
                        ),
                        meta: z.object({
                            page: z.number(),
                            limit: z.number(),
                            total: z.number(),
                            total_pages: z.number(),
                        }),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.string(),
                            message: z.string(),
                        }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.string(),
                            message: z.string(),
                        }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.string(),
                            message: z.string(),
                        }),
                    }),
                },
            },
        },
        pvpController.getMatchHistory
    );

    // 3. Record Match Result (Internal API)
    router.post(
        "/api/v1/pvp/matches",
        {
            onRequest: [internalKeyGuard],
            schema: {
                tags: ["PVP"],
                summary: "Record Match Result (Internal / Post-Match)",
                body: recordMatchBodySchema,
                response: {
                    201: z.object({
                        success: z.boolean(),
                        data: z.object({
                            match_id: z.string(),
                        }),
                        message: z.string(),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.string(),
                            message: z.string(),
                        }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.string(),
                            message: z.string(),
                        }),
                    }),
                    422: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.string(),
                            message: z.string(),
                        }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.string(),
                            message: z.string(),
                        }),
                    }),
                },
            },
        },
        pvpController.recordMatch
    );

    // 4. Get PVP Leaderboard
    router.get(
        "/api/v1/pvp/leaderboard",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["PVP"],
                summary: "Get PVP Leaderboard",
                querystring: getLeaderboardQuerySchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            entries: z.array(
                                z.object({
                                    rank: z.number(),
                                    user_id: z.string(),
                                    display_name: z.string(),
                                    avatar: z.string().nullable(),
                                    rating: z.number(),
                                    wins: z.number(),
                                    total_matches: z.number(),
                                    win_rate: z.number().nullable(),
                                })
                            ),
                            current_user: z
                                .object({
                                    rank: z.number(),
                                    rating: z.number(),
                                    total_matches: z.number(),
                                })
                                .nullable(),
                        }),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.string(),
                            message: z.string(),
                        }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.string(),
                            message: z.string(),
                        }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.string(),
                            message: z.string(),
                        }),
                    }),
                },
            },
        },
        pvpController.getLeaderboard
    );
}
