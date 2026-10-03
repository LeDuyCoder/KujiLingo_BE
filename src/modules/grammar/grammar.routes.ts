import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { adminGuard } from "../../common/middlewares/admin.guard.js";
import { verifyToken } from "../../common/utils/jwt.js";
import { authRepository } from "../auth/auth.repository.js";
import { grammarController } from "./grammar.controller.js";
import {
    createGrammarBodySchema,
    grammarIdParamSchema,
    listGrammarQuerySchema,
    updateGrammarBodySchema,
} from "./grammar.schema.js";

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
        // Silently ignore invalid token for optional auth
    }
}

export async function grammarRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    // 1. List Grammar Points (Public)
    router.get(
        "/api/v1/grammar",
        {
            preHandler: [optionalAuthGuard],
            schema: {
                tags: ["Grammar"],
                summary: "List Grammar Points",
                description: "Returns a filterable, paginated list of grammar points.",
                querystring: listGrammarQuerySchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.array(
                            z.object({
                                id: z.string().uuid(),
                                title_jp: z.string(),
                                structure: z.string(),
                                meaning_vi: z.string(),
                                jlpt_level: z.string(),
                                is_saved: z.boolean().optional(),
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
        grammarController.list
    );

    // 2. Get Grammar Point Detail (Public)
    router.get(
        "/api/v1/grammar/:id",
        {
            preHandler: [optionalAuthGuard],
            schema: {
                tags: ["Grammar"],
                summary: "Get Grammar Point Detail",
                description: "Returns full detail of a single grammar point.",
                params: grammarIdParamSchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            id: z.string().uuid(),
                            title_jp: z.string(),
                            structure: z.string(),
                            meaning_vi: z.string(),
                            explanation: z.string().nullable().optional(),
                            jlpt_level: z.string(),
                            example_sentences: z.array(z.any()).optional(),
                            is_saved: z.boolean().optional(),
                            folder_ids: z.array(z.string()).optional(),
                        }),
                    }),
                },
            },
        },
        grammarController.getById
    );

    // 3. Create Grammar Point (Admin)
    router.post(
        "/api/v1/admin/grammar",
        {
            preHandler: [adminGuard],
            schema: {
                tags: ["Admin Grammar"],
                summary: "Create Grammar Point (Admin)",
                description: "Allows an administrator to add a new grammar point.",
                body: createGrammarBodySchema,
                response: {
                    201: z.object({
                        success: z.boolean(),
                        data: z.object({
                            id: z.string().uuid(),
                            title_jp: z.string(),
                            jlpt_level: z.string(),
                            created_at: z.date(),
                        }),
                        message: z.string(),
                    }),
                },
            },
        },
        grammarController.create
    );

    // 4. Update Grammar Point (Admin)
    router.put(
        "/api/v1/admin/grammar/:id",
        {
            preHandler: [adminGuard],
            schema: {
                tags: ["Admin Grammar"],
                summary: "Update Grammar Point (Admin)",
                description: "Allows an administrator to edit an existing grammar point.",
                params: grammarIdParamSchema,
                body: updateGrammarBodySchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            id: z.string().uuid(),
                            updated_at: z.date(),
                        }),
                        message: z.string(),
                    }),
                },
            },
        },
        grammarController.update
    );

    // 5. Delete Grammar Point (Admin)
    router.delete(
        "/api/v1/admin/grammar/:id",
        {
            preHandler: [adminGuard],
            schema: {
                tags: ["Admin Grammar"],
                summary: "Delete Grammar Point (Admin)",
                description: "Soft-deletes a grammar point.",
                params: grammarIdParamSchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        message: z.string(),
                    }),
                },
            },
        },
        grammarController.delete
    );
}
