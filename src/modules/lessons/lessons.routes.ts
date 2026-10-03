import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { adminGuard } from "../../common/middlewares/admin.guard.js";
import { lessonsController } from "./lessons.controller.js";
import {
    getLessonDetailParamsSchema,
    getLessonDetailResponseSchema,
    createLessonBodySchema,
    createLessonResponseSchema,
    updateLessonParamsSchema,
    updateLessonBodySchema,
    updateLessonResponseSchema,
    deleteLessonParamsSchema,
    deleteLessonResponseSchema
} from "./lessons.schema.js";

export async function lessonsRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    // ==========================================
    // Public Endpoints
    // ==========================================

    router.get(
        "/api/v1/lessons/:id",
        {
            schema: {
                tags: ["Lessons"],
                summary: "Get Lesson Detail",
                description: "Returns a lesson with its ordered list of topics.",
                params: getLessonDetailParamsSchema,
                response: {
                    200: getLessonDetailResponseSchema,
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() })
                    }),
                    404: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("LESSON_NOT_FOUND"), message: z.string() })
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() })
                    })
                }
            }
        },
        lessonsController.getLessonDetail
    );

    // ==========================================
    // Admin Endpoints
    // ==========================================

    await router.register(async (adminRouter) => {
        adminRouter.addHook("preHandler", adminGuard);

        // 2. Create Lesson
        adminRouter.post(
            "/api/v1/admin/lessons",
            {
                schema: {
                    tags: ["Admin Lessons"],
                    summary: "Create Lesson (Admin)",
                    description: "Allows an administrator to add a new lesson under a course.",
                    body: createLessonBodySchema,
                    response: {
                        201: createLessonResponseSchema,
                        400: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() })
                        }),
                        401: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() })
                        }),
                        403: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("FORBIDDEN"), message: z.string() })
                        }),
                        422: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("INVALID_COURSE_REFERENCE"), message: z.string() })
                        }),
                        500: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() })
                        })
                    }
                }
            },
            lessonsController.create
        );

        // 3. Update Lesson
        adminRouter.put(
            "/api/v1/admin/lessons/:id",
            {
                schema: {
                    tags: ["Admin Lessons"],
                    summary: "Update Lesson (Admin)",
                    description: "Allows an administrator to edit an existing lesson.",
                    params: updateLessonParamsSchema,
                    body: updateLessonBodySchema,
                    response: {
                        200: updateLessonResponseSchema,
                        400: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.union([z.literal("VALIDATION_ERROR"), z.literal("EMPTY_UPDATE")]), message: z.string() })
                        }),
                        401: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() })
                        }),
                        403: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("FORBIDDEN"), message: z.string() })
                        }),
                        404: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("LESSON_NOT_FOUND"), message: z.string() })
                        }),
                        422: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("INVALID_COURSE_REFERENCE"), message: z.string() })
                        }),
                        500: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() })
                        })
                    }
                }
            },
            lessonsController.update
        );

        // 4. Delete Lesson
        adminRouter.delete(
            "/api/v1/admin/lessons/:id",
            {
                schema: {
                    tags: ["Admin Lessons"],
                    summary: "Delete Lesson (Admin)",
                    description: "Permanently deletes a lesson.",
                    params: deleteLessonParamsSchema,
                    response: {
                        200: deleteLessonResponseSchema,
                        400: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() })
                        }),
                        401: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() })
                        }),
                        403: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("FORBIDDEN"), message: z.string() })
                        }),
                        404: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("LESSON_NOT_FOUND"), message: z.string() })
                        }),
                        409: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("LESSON_NOT_EMPTY"), message: z.string() })
                        }),
                        500: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() })
                        })
                    }
                }
            },
            lessonsController.delete
        );
    });
}
