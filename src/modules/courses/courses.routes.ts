import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { adminGuard } from "../../common/middlewares/admin.guard.js";
import {
    listCoursesHandler,
    getCourseDetailHandler,
    createCourseHandler,
    updateCourseHandler,
    deleteCourseHandler,
    restoreCourseHandler,
} from "./courses.controller.js";
import {
    listCoursesQuerySchema,
    courseIdParamsSchema,
    createCourseBodySchema,
    updateCourseBodySchema,
} from "./courses.schema.js";

export async function coursesRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    // ==========================================
    // Public Endpoints
    // ==========================================

    // 1. List Courses
    router.get(
        "/courses",
        {
            schema: {
                tags: ["Courses"],
                summary: "List Courses",
                description: "Returns the catalog of courses, ordered by order_no.",
                querystring: listCoursesQuerySchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.array(
                            z.object({
                                id: z.string().uuid(),
                                title: z.string().nullable(),
                                description: z.string().nullable(),
                                image: z.string().nullable(),
                                order_no: z.number().nullable(),
                                lesson_count: z.number(),
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
                        error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        listCoursesHandler
    );

    // 2. Get Course Detail
    router.get(
        "/courses/:id",
        {
            schema: {
                tags: ["Courses"],
                summary: "Get Course Detail",
                description: "Returns a course with its ordered list of lessons.",
                params: courseIdParamsSchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            id: z.string().uuid(),
                            title: z.string().nullable(),
                            description: z.string().nullable(),
                            image: z.string().nullable(),
                            lessons: z.array(
                                z.object({
                                    id: z.string().uuid(),
                                    title: z.string().nullable(),
                                    description: z.string().nullable(),
                                    order_no: z.number().nullable(),
                                })
                            ),
                        }),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() }),
                    }),
                    404: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("COURSE_NOT_FOUND"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        getCourseDetailHandler
    );

    // ==========================================
    // Admin Endpoints
    // ==========================================

    router.register(async (adminRouter) => {
        adminRouter.addHook("preHandler", adminGuard);

        // 3. Create Course
        adminRouter.post(
            "/admin/courses",
            {
                schema: {
                    tags: ["Admin Courses"],
                    summary: "Create Course (Admin)",
                    description: "Allows an administrator to create a new course.",
                    body: createCourseBodySchema,
                    response: {
                        201: z.object({
                            success: z.boolean(),
                            data: z.object({
                                id: z.string().uuid(),
                                title: z.string().nullable(),
                                order_no: z.number().nullable(),
                            }),
                            message: z.string(),
                        }),
                        400: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() }),
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
            createCourseHandler
        );

        // 4. Update Course
        adminRouter.put(
            "/admin/courses/:id",
            {
                schema: {
                    tags: ["Admin Courses"],
                    summary: "Update Course (Admin)",
                    description: "Allows an administrator to edit an existing course's fields.",
                    params: courseIdParamsSchema,
                    body: updateCourseBodySchema,
                    response: {
                        200: z.object({
                            success: z.boolean(),
                            data: z.object({
                                id: z.string().uuid(),
                                title: z.string().nullable(),
                            }),
                            message: z.string(),
                        }),
                        400: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.enum(["VALIDATION_ERROR", "EMPTY_UPDATE"]), message: z.string() }),
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
                            error: z.object({ code: z.literal("COURSE_NOT_FOUND"), message: z.string() }),
                        }),
                        500: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                        }),
                    },
                },
            },
            updateCourseHandler
        );

        // 5. Delete Course (Soft Delete)
        adminRouter.delete(
            "/admin/courses/:id",
            {
                schema: {
                    tags: ["Admin Courses"],
                    summary: "Delete Course (Admin)",
                    description: "Permanently (Soft) deletes a course.",
                    params: courseIdParamsSchema,
                    response: {
                        200: z.object({
                            success: z.boolean(),
                            message: z.string(),
                        }),
                        400: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() }),
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
                            error: z.object({ code: z.literal("COURSE_NOT_FOUND"), message: z.string() }),
                        }),
                        409: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("COURSE_NOT_EMPTY"), message: z.string() }),
                        }),
                        500: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                        }),
                    },
                },
            },
            deleteCourseHandler
        );

        // 6. Restore Course
        adminRouter.post(
            "/admin/courses/:id/restore",
            {
                schema: {
                    tags: ["Admin Courses"],
                    summary: "Restore Course (Admin)",
                    description: "Restores a soft-deleted course.",
                    params: courseIdParamsSchema,
                    response: {
                        200: z.object({
                            success: z.boolean(),
                            message: z.string(),
                        }),
                        400: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() }),
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
                            error: z.object({ code: z.literal("COURSE_NOT_FOUND"), message: z.string() }),
                        }),
                        500: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                        }),
                    },
                },
            },
            restoreCourseHandler
        );
    });
}
