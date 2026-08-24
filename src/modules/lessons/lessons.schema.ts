import { z } from "zod";

// --- GET /api/v1/lessons/{id} ---
export const getLessonDetailParamsSchema = z.object({
    id: z.string().uuid("id must be a valid UUID."),
});

export const getLessonDetailResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        id: z.string().uuid(),
        course_id: z.string().uuid().nullable(),
        title: z.string().nullable(),
        description: z.string().nullable(),
        topics: z.array(z.object({
            id: z.string().uuid(),
            title: z.string().nullable(),
            description: z.string().nullable(),
            image: z.string().nullable(),
            order_no: z.number(),
        })),
    }),
});

// --- POST /api/v1/admin/lessons ---
export const createLessonBodySchema = z.object({
    course_id: z.string().uuid("course_id must be a valid UUID."),
    title: z.string().trim().min(3, "title must be between 3 and 255 characters.").max(255, "title must be between 3 and 255 characters."),
    description: z.string().max(2000, "description must not exceed 2000 characters.").optional(),
    order_no: z.number().int().nonnegative("order_no must be a non-negative integer.").optional(),
});

export const createLessonResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        id: z.string().uuid(),
        course_id: z.string().uuid().nullable(),
        title: z.string().nullable(),
        order_no: z.number().nullable(),
    }),
    message: z.string(),
});

// --- PUT /api/v1/admin/lessons/{id} ---
export const updateLessonParamsSchema = z.object({
    id: z.string().uuid("id must be a valid UUID."),
});

export const updateLessonBodySchema = z.object({
    course_id: z.string().uuid("course_id must be a valid UUID.").optional(),
    title: z.string().trim().min(3, "title must be between 3 and 255 characters.").max(255, "title must be between 3 and 255 characters.").optional(),
    description: z.string().max(2000, "description must not exceed 2000 characters.").optional(),
    order_no: z.number().int().nonnegative("order_no must be a non-negative integer.").optional(),
});

export const updateLessonResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        id: z.string().uuid(),
        title: z.string().nullable(),
    }),
    message: z.string(),
});

// --- DELETE /api/v1/admin/lessons/{id} ---
export const deleteLessonParamsSchema = z.object({
    id: z.string().uuid("id must be a valid UUID."),
});

export const deleteLessonResponseSchema = z.object({
    success: z.boolean(),
    message: z.string(),
});
