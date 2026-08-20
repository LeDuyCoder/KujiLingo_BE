import z from "zod";

export const listCoursesQuerySchema = z.object({
    page: z
        .coerce
        .number()
        .min(1)
        .default(1),
    limit: z
        .coerce
        .number()
        .min(1)
        .max(50)
        .default(20),
});

export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;

export const courseIdParamsSchema = z.object({
    id: z.string().uuid(),
});

export type CourseIdParams = z.infer<typeof courseIdParamsSchema>;

export const createCourseBodySchema = z.object({
    title: z.string().trim().min(3).max(255),
    description: z.string().max(2000).optional(),
    image: z.string().url().max(500).optional().or(z.literal("")),
    order_no: z.number().int().nonnegative().optional(),
});

export type CreateCourseBody = z.infer<typeof createCourseBodySchema>;

export const updateCourseBodySchema = createCourseBodySchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field must be provided for update.", path: ["_root"] }
);

export type UpdateCourseBody = z.infer<typeof updateCourseBodySchema>;
