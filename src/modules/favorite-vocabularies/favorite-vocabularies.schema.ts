import { z } from "zod";

export const listFavoritesQuerySchema = z.object({
    page: z
        .coerce
        .number()
        .int()
        .min(1)
        .default(1),
    limit: z
        .coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(30),
});

export const addFavoriteBodySchema = z.object({
    vocabulary_id: z.string().uuid({ message: "vocabulary_id must be a valid UUID." }),
});

export const removeFavoriteParamsSchema = z.object({
    vocabularyId: z.string().uuid({ message: "vocabularyId must be a valid UUID." }),
});
