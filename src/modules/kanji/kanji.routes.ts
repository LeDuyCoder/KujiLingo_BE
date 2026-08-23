import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { adminGuard } from "../../common/middlewares/admin.guard.js";
import { verifyToken } from "../../common/utils/jwt.js";
import { authRepository } from "../auth/auth.repository.js";
import { kanjiController } from "./kanji.controller.js";
import {
    createKanjiBodySchema,
    kanjiIdParamSchema,
    listKanjiQuerySchema,
    updateKanjiBodySchema,
} from "./kanji.schema.js";

async function optionalAuthGuard(request: FastifyRequest, _reply: FastifyReply) {
    try {
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];
            if (token) {
                const decoded = verifyToken(token) as { sub: string; role: string };
                const user = await authRepository.findUserById(decoded.sub);
                if (user && user.status === "active") {
                    request.user = { id: user.id, role: user.role };
                }
            }
        }
    } catch {
        // Silently ignore invalid token
    }
}

export async function kanjiRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    // 1. List Kanji (Public)
    router.get(
        "/api/v1/kanji",
        {
            preHandler: [optionalAuthGuard],
            schema: {
                tags: ["Kanji"],
                summary: "List Kanji",
                querystring: listKanjiQuerySchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.array(
                            z.object({
                                id: z.string().uuid(),
                                character: z.string(),
                                meaning_vi: z.string(),
                                onyomi: z.string(),
                                kunyomi: z.string(),
                                stroke_count: z.number(),
                                jlpt_level: z.string(),
                                is_saved: z.boolean(),
                            })
                        ),
                        meta: z.object({
                            page: z.number(),
                            limit: z.number(),
                            total: z.number(),
                            total_pages: z.number(),
                        }),
                    }),
                },
            },
        },
        kanjiController.list
    );

    // 2. Get Kanji Detail (Public)
    router.get(
        "/api/v1/kanji/:id",
        {
            preHandler: [optionalAuthGuard],
            schema: {
                tags: ["Kanji"],
                summary: "Get Kanji Detail",
                params: kanjiIdParamSchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            id: z.string().uuid(),
                            character: z.string(),
                            meaning_vi: z.string(),
                            onyomi: z.string(),
                            kunyomi: z.string(),
                            stroke_count: z.number(),
                            jlpt_level: z.string(),
                            radical: z.string(),
                            stroke_order_image_url: z.string(),
                            examples: z.array(z.any()),
                            is_saved: z.boolean(),
                            folder_ids: z.array(z.string()),
                        }),
                    }),
                },
            },
        },
        kanjiController.getById
    );

    // 3. Create Kanji (Admin)
    router.post(
        "/api/v1/admin/kanji",
        {
            preHandler: [adminGuard],
            schema: {
                tags: ["Admin Kanji"],
                summary: "Create Kanji (Admin)",
                body: createKanjiBodySchema,
                response: {
                    201: z.object({
                        success: z.boolean(),
                        data: z.object({
                            id: z.string().uuid(),
                            character: z.string(),
                            jlpt_level: z.string(),
                            created_at: z.date(),
                        }),
                        message: z.string(),
                    }),
                },
            },
        },
        kanjiController.create
    );

    // 4. Update Kanji (Admin)
    router.put(
        "/api/v1/admin/kanji/:id",
        {
            preHandler: [adminGuard],
            schema: {
                tags: ["Admin Kanji"],
                summary: "Update Kanji (Admin)",
                params: kanjiIdParamSchema,
                body: updateKanjiBodySchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            id: z.string().uuid(),
                        }),
                        message: z.string(),
                    }),
                },
            },
        },
        kanjiController.update
    );

    // 5. Delete Kanji (Admin)
    router.delete(
        "/api/v1/admin/kanji/:id",
        {
            preHandler: [adminGuard],
            schema: {
                tags: ["Admin Kanji"],
                summary: "Delete Kanji (Admin)",
                params: kanjiIdParamSchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        message: z.string(),
                    }),
                },
            },
        },
        kanjiController.delete
    );
}
