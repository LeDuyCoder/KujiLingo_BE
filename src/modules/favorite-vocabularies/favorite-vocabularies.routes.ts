import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { authGuard } from "../../common/middlewares/auth.guard.js";
import {
    listFavoritesHandler,
    addFavoriteHandler,
    removeFavoriteHandler,
} from "./favorite-vocabularies.controller.js";
import {
    listFavoritesQuerySchema,
    addFavoriteBodySchema,
    removeFavoriteParamsSchema,
} from "./favorite-vocabularies.schema.js";

export async function favoriteVocabulariesRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    // 1. List Favorites
    router.get(
        "/api/v1/favorite-vocabularies",
        {
            preHandler: [authGuard],
            schema: {
                tags: ["Favorite Vocabularies"],
                summary: "List Favorites",
                description: "Returns the authenticated user's favorited vocabulary items.",
                querystring: listFavoritesQuerySchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.array(
                            z.object({
                                vocabulary_id: z.string().uuid(),
                                kanji: z.string().nullable(),
                                hiragana: z.string().nullable(),
                                meaning: z.string().nullable(),
                                jlpt: z.string().nullable(),
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
        listFavoritesHandler
    );

    // 2. Add Favorite
    router.post(
        "/api/v1/favorite-vocabularies",
        {
            preHandler: [authGuard],
            schema: {
                tags: ["Favorite Vocabularies"],
                summary: "Add Favorite",
                description: "Marks a vocabulary item as favorited for the authenticated user.",
                body: addFavoriteBodySchema,
                response: {
                    201: z.object({
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
                    409: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("ALREADY_FAVORITED"), message: z.string() }),
                    }),
                    422: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INVALID_VOCABULARY_REFERENCE"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        addFavoriteHandler
    );

    // 3. Remove Favorite
    router.delete(
        "/api/v1/favorite-vocabularies/:vocabularyId",
        {
            preHandler: [authGuard],
            schema: {
                tags: ["Favorite Vocabularies"],
                summary: "Remove Favorite",
                description: "Removes a favorite. Idempotent.",
                params: removeFavoriteParamsSchema,
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
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        removeFavoriteHandler
    );
}
