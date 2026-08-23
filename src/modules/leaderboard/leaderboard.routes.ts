import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { authGuard } from "../../common/middlewares/auth.guard.js";
import { leaderboardController } from "./leaderboard.controller.js";
import { getLeaderboardQuerySchema } from "./leaderboard.schema.js";

export async function leaderboardRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    router.get(
        "/api/v1/leaderboard",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["Leaderboard"],
                summary: "Get Leaderboard",
                querystring: getLeaderboardQuerySchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            period_type: z.enum(["daily", "weekly", "monthly", "all_time"]),
                            period_key: z.string(),
                            entries: z.array(
                                z.object({
                                    rank: z.number(),
                                    user_id: z.string(),
                                    display_name: z.string().nullable(),
                                    avatar_url: z.string().nullable(),
                                    xp_total: z.number(),
                                })
                            ),
                            current_user: z
                                .object({
                                    rank: z.number(),
                                    xp_total: z.number(),
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
        leaderboardController.get
    );
}
