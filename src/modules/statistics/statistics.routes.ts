import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getStatisticsHandler } from "./statistics.controller.js";
import { authGuard } from "../../common/middlewares/auth.guard.js";

export async function statisticsRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    router.get(
        "/api/v1/statistics/me",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["Statistics"],
                summary: "Get User Statistics Summary",
                description: "Returns the authenticated user's top-level statistics: level, EXP, streak, total reviews, correct reviews, accuracy percentage, and total mastered vocabulary.",
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            level: z.number().nullable(),
                            exp: z.number().nullable(),
                            streak: z.number().nullable(),
                            total_reviews: z.number(),
                            correct_reviews: z.number(),
                            accuracy_percent: z.number().nullable(),
                            total_mastered: z.number(),
                        }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.literal("UNAUTHORIZED"),
                            message: z.string(),
                        }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({
                            code: z.literal("INTERNAL_ERROR"),
                            message: z.string(),
                        }),
                    }),
                },
            },
        },
        getStatisticsHandler
    );
}
