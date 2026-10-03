import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { userVocabularyController } from "./user-vocabularies.controller.js";
import { authGuard } from "../../common/middlewares/auth.guard.js";

export async function userVocabulariesRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    router.get(
        "/api/v1/user-vocabularies",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["User Vocabulary"],
                summary: "List user custom vocabulary",
                querystring: z.object({
                    search: z.string().max(100).optional(),
                    page: z.coerce.number().int().min(1).default(1),
                    limit: z.coerce.number().int().min(1).max(100).default(30),
                }),
            },
        },
        userVocabularyController.list
    );

    router.post(
        "/api/v1/user-vocabularies",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["User Vocabulary"],
                summary: "Create a new custom vocabulary entry",
                body: z.object({
                    kanji: z.string().min(1).max(100),
                    hiragana: z.string().max(150).optional(),
                    romaji: z.string().max(150).optional(),
                    meaning: z.string().min(1).max(500),
                    note: z.string().max(1000).optional(),
                    image: z.string().url().optional().or(z.literal("")),
                    audio: z.string().url().optional().or(z.literal("")),
                }),
            },
        },
        userVocabularyController.create
    );

    router.put(
        "/api/v1/user-vocabularies/:id",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["User Vocabulary"],
                summary: "Update an existing custom vocabulary entry",
                params: z.object({
                    id: z.string().uuid(),
                }),
                body: z.object({
                    kanji: z.string().min(1).max(100).optional(),
                    hiragana: z.string().max(150).optional(),
                    romaji: z.string().max(150).optional(),
                    meaning: z.string().min(1).max(500).optional(),
                    note: z.string().max(1000).optional(),
                    image: z.string().url().optional().or(z.literal("")),
                    audio: z.string().url().optional().or(z.literal("")),
                }),
            },
        },
        userVocabularyController.update
    );

    router.delete(
        "/api/v1/user-vocabularies/:id",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["User Vocabulary"],
                summary: "Permanently delete a custom vocabulary entry",
                params: z.object({
                    id: z.string().uuid(),
                }),
            },
        },
        userVocabularyController.delete
    );
}
