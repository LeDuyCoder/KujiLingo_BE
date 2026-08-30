import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { authGuard } from "../../common/middlewares/auth.guard.js";
import { adminGuard } from "../../common/middlewares/admin.guard.js";
import { achievementsController } from "./achievements.controller.js";
import {
    achievementCatalogQuerySchema,
    getMyAchievementsQuerySchema,
    achievementIdParamSchema,
    createAchievementBodySchema,
    updateAchievementBodySchema,
} from "./achievements.schema.js";

export async function achievementsRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    const achievementItemSchema = z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        icon: z.string(),
        type: z.string(),
        condition_value: z.number(),
        reward_exp: z.number(),
        is_unlocked: z.boolean(),
        unlocked_at: z.string().nullable(),
        current_value: z.number(),
        progress_percent: z.number(),
    });

    // 1. Get Achievement Catalog
    router.get(
        "/api/v1/achievements/catalog",
        {
            preHandler: [authGuard],
            schema: {
                tags: ["Achievements"],
                summary: "Get Achievement Catalog",
                description: "Returns the global achievement catalog available to all users with current user's progress.",
                querystring: achievementCatalogQuerySchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            items: z.array(achievementItemSchema),
                            pagination: z.object({
                                page: z.number(),
                                limit: z.number(),
                                total: z.number(),
                            }),
                        }),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() }),
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
        achievementsController.getCatalog
    );

    // 2. Get My Achievements
    router.get(
        "/api/v1/achievements/me",
        {
            preHandler: [authGuard],
            schema: {
                tags: ["Achievements"],
                summary: "Get My Achievements",
                description: "Returns all achievements for the user grouped by status (unlocked, in_progress, not_started).",
                querystring: getMyAchievementsQuerySchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            summary: z.object({
                                total_achievements: z.number(),
                                unlocked_count: z.number(),
                                in_progress_count: z.number(),
                                not_started_count: z.number(),
                            }),
                            items: z.array(
                                achievementItemSchema.extend({
                                    status: z.enum(["unlocked", "in_progress", "not_started"]),
                                })
                            ),
                        }),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() }),
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
        achievementsController.getMyAchievements
    );

    // 3. Get My Achievement Detail
    router.get(
        "/api/v1/achievements/me/:achievementId",
        {
            preHandler: [authGuard],
            schema: {
                tags: ["Achievements"],
                summary: "Get My Achievement Detail",
                description: "Returns detailed information and progress for a specific achievement.",
                params: achievementIdParamSchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: achievementItemSchema.extend({
                            status: z.enum(["unlocked", "in_progress", "not_started"]),
                            remaining_value: z.number(),
                        }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() }),
                    }),
                    404: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("ACHIEVEMENT_NOT_FOUND"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        achievementsController.getMyAchievementDetail
    );

    // 4. Admin Create Achievement
    router.post(
        "/api/v1/achievements",
        {
            preHandler: [adminGuard],
            schema: {
                tags: ["Admin", "Achievements"],
                summary: "Create Achievement",
                description: "Allows admins to create a new achievement definition.",
                body: createAchievementBodySchema,
                response: {
                    201: z.object({
                        success: z.boolean(),
                        data: z.object({
                            id: z.string(),
                            title: z.string(),
                            description: z.string(),
                            icon: z.string(),
                            type: z.string(),
                            condition_value: z.number(),
                            reward_exp: z.number(),
                            created_at: z.string(),
                        }),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.enum(["VALIDATION_ERROR", "DUPLICATE_ACHIEVEMENT"]), message: z.string() }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() }),
                    }),
                    403: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("FORBIDDEN"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        achievementsController.create
    );

    // 5. Admin Update Achievement
    router.patch(
        "/api/v1/achievements/:achievementId",
        {
            preHandler: [adminGuard],
            schema: {
                tags: ["Admin", "Achievements"],
                summary: "Update Achievement",
                description: "Allows admins to update an existing achievement definition.",
                params: achievementIdParamSchema,
                body: updateAchievementBodySchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            id: z.string(),
                            title: z.string(),
                            description: z.string(),
                            icon: z.string(),
                            type: z.string(),
                            condition_value: z.number(),
                            reward_exp: z.number(),
                            updated_at: z.string(),
                        }),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.enum(["VALIDATION_ERROR", "DUPLICATE_ACHIEVEMENT"]), message: z.string() }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() }),
                    }),
                    403: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("FORBIDDEN"), message: z.string() }),
                    }),
                    404: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("ACHIEVEMENT_NOT_FOUND"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        achievementsController.update
    );
}
