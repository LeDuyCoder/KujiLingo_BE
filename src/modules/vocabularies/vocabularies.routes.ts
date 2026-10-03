import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { vocabulariesController } from "./vocabularies.controller.js";
import { adminGuard } from "../../common/middlewares/admin.guard.js";
import { verifyToken } from "../../common/utils/jwt.js";

async function optionalAuth(request: any) {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        if (token) {
            try {
                const decoded = verifyToken(token) as { sub: string; role: string };
                request.user = { id: decoded.sub, role: decoded.role };
            } catch (err) {
                // Ignore invalid token for optional auth, just treat as guest
            }
        }
    }
}

export async function vocabulariesRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    // 1. List Vocabulary (Public, Optional Auth)
    router.get(
        "/api/v1/vocabularies",
        {
            onRequest: [optionalAuth],
            schema: {
                tags: ["Vocabulary"],
                summary: "List vocabulary with filters and search",
                querystring: z.object({
                    jlpt_level: z.enum(["N5", "N4", "N3", "N2", "N1"]).optional(),
                    topic_id: z.string().uuid().optional(),
                    lesson_id: z.string().uuid().optional(),
                    search: z.string().max(100).optional(),
                    page: z.coerce.number().int().min(1).default(1),
                    limit: z.coerce.number().int().min(1).max(100).default(30),
                }),
            },
        },
        vocabulariesController.list
    );

    // 2. Get Vocabulary Detail (Public, Optional Auth)
    router.get(
        "/api/v1/vocabularies/:id",
        {
            onRequest: [optionalAuth],
            schema: {
                tags: ["Vocabulary"],
                summary: "Get vocabulary detail by ID",
                params: z.object({
                    id: z.string().uuid(),
                }),
            },
        },
        vocabulariesController.getDetail
    );

    // Admin Endpoints
    // 3. Create Vocabulary (Admin Only)
    router.post(
        "/api/v1/admin/vocabularies",
        {
            onRequest: [adminGuard],
            schema: {
                tags: ["Admin Vocabulary"],
                summary: "Create a new platform vocabulary (Admin)",
                body: z.object({
                    word_jp: z.string().min(1).max(100),
                    reading_hiragana: z.string().min(1).max(150),
                    reading_romaji: z.string().max(150).optional(),
                    meaning_vi: z.string().min(1).max(500),
                    meaning_en: z.string().max(500).optional(),
                    part_of_speech: z.string().max(50).optional(),
                    jlpt_level: z.enum(["N5", "N4", "N3", "N2", "N1"]),
                    example_sentence_jp: z.string().max(500).optional(),
                    example_sentence_vi: z.string().max(500).optional(),
                    audio_url: z.string().url().optional().or(z.literal("")),
                    image_url: z.string().url().optional().or(z.literal("")),
                    lesson_id: z.string().uuid().optional(),
                    topic_id: z.string().uuid().optional(),
                    frequency_rank: z.coerce.number().int().positive().optional(),
                }),
            },
        },
        vocabulariesController.create
    );

    // 4. Update Vocabulary (Admin Only)
    router.put(
        "/api/v1/admin/vocabularies/:id",
        {
            onRequest: [adminGuard],
            schema: {
                tags: ["Admin Vocabulary"],
                summary: "Update an existing platform vocabulary (Admin)",
                params: z.object({
                    id: z.string().uuid(),
                }),
                body: z.object({
                    word_jp: z.string().min(1).max(100).optional(),
                    reading_hiragana: z.string().min(1).max(150).optional(),
                    reading_romaji: z.string().max(150).optional(),
                    meaning_vi: z.string().min(1).max(500).optional(),
                    meaning_en: z.string().max(500).optional(),
                    part_of_speech: z.string().max(50).optional(),
                    jlpt_level: z.enum(["N5", "N4", "N3", "N2", "N1"]).optional(),
                    example_sentence_jp: z.string().max(500).optional(),
                    example_sentence_vi: z.string().max(500).optional(),
                    audio_url: z.string().url().optional().or(z.literal("")),
                    image_url: z.string().url().optional().or(z.literal("")),
                    lesson_id: z.string().uuid().optional(),
                    topic_id: z.string().uuid().optional(),
                    frequency_rank: z.coerce.number().int().positive().optional(),
                }),
            },
        },
        vocabulariesController.update
    );

    // 5. Delete Vocabulary (Admin Only)
    router.delete(
        "/api/v1/admin/vocabularies/:id",
        {
            onRequest: [adminGuard],
            schema: {
                tags: ["Admin Vocabulary"],
                summary: "Soft-delete a platform vocabulary (Admin)",
                params: z.object({
                    id: z.string().uuid(),
                }),
            },
        },
        vocabulariesController.delete
    );
}
