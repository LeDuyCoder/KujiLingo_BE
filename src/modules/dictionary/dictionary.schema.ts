import z from "zod";

export const searchQueryParamsSchema = z.object({
    q: z.string().trim().min(1).max(100),
    jlpt_level: z.enum(["N5", "N4", "N3", "N2", "N1"]).optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20)
});

export const dictionaryIdParamasSchema = z.object({
    id: z.string().uuid(),
});