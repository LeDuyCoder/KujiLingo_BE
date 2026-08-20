import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDashboardSummaryHandler } from "./dashboard.controller.js";
import { authGuard } from "../../common/middlewares/auth.guard.js";

export async function dashboardRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    router.get(
        "/dashboard",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["Dashboard"],
                summary: "Get Dashboard Summary",
                description: "Returns aggregated learning progress for the user's home screen.",
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            streak: z.object({
                                current_streak_days: z.number(),
                                longest_streak_days: z.number(),
                                is_at_risk: z.boolean(),
                            }),
                            daily_goal_progress: z.object({
                                minutes_studied_today: z.number(),
                                goal_minutes: z.number(),
                                percent: z.number(),
                            }),
                            continue_learning: z.object({
                                lesson_id: z.string().uuid(),
                                lesson_title: z.string(),
                                course_title: z.string(),
                                reason: z.enum(["in_progress", "next_up", "recommended"]),
                            }).nullable(),
                            srs_due_count: z.number(),
                            recent_achievements: z.array(z.string()),
                        }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        getDashboardSummaryHandler
    );
}