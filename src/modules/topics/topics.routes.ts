import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { adminGuard } from "../../common/middlewares/admin.guard.js";
import { topicsController } from "./topics.controller.js";
import {
    getTopicDetailParamsSchema,
    getTopicDetailResponseSchema,
    createTopicBodySchema,
    createTopicResponseSchema,
    updateTopicParamsSchema,
    updateTopicBodySchema,
    updateTopicResponseSchema,
    deleteTopicParamsSchema,
    deleteTopicResponseSchema,
    addVocabularyParamsSchema,
    addVocabularyBodySchema,
    addVocabularyResponseSchema,
    removeVocabularyParamsSchema,
    removeVocabularyResponseSchema
} from "./topics.schema.js";

export async function topicsRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    // ==========================================
    // Public Endpoints
    // ==========================================

    router.get(
        "/api/v1/topics/:id",
        {
            schema: {
                tags: ["Topics"],
                summary: "Get Topic Detail",
                description: "Returns a topic with its associated vocabulary list.",
                params: getTopicDetailParamsSchema,
                response: {
                    200: getTopicDetailResponseSchema,
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() })
                    }),
                    404: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("TOPIC_NOT_FOUND"), message: z.string() })
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() })
                    })
                }
            }
        },
        topicsController.getTopicDetail
    );

    // ==========================================
    // Admin Endpoints
    // ==========================================

    await router.register(async (adminRouter) => {
        adminRouter.addHook("preHandler", adminGuard);

        // 2. Create Topic
        adminRouter.post(
            "/api/v1/admin/topics",
            {
                schema: {
                    tags: ["Admin Topics"],
                    summary: "Create Topic (Admin)",
                    description: "Allows an administrator to add a new topic under a lesson.",
                    body: createTopicBodySchema,
                    response: {
                        201: createTopicResponseSchema,
                        400: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() })
                        }),
                        401: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() })
                        }),
                        403: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("FORBIDDEN"), message: z.string() })
                        }),
                        422: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("INVALID_LESSON_REFERENCE"), message: z.string() })
                        }),
                        500: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() })
                        })
                    }
                }
            },
            topicsController.create
        );

        // 3. Update Topic
        adminRouter.put(
            "/api/v1/admin/topics/:id",
            {
                schema: {
                    tags: ["Admin Topics"],
                    summary: "Update Topic (Admin)",
                    description: "Allows an administrator to edit an existing topic.",
                    params: updateTopicParamsSchema,
                    body: updateTopicBodySchema,
                    response: {
                        200: updateTopicResponseSchema,
                        400: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.union([z.literal("VALIDATION_ERROR"), z.literal("EMPTY_UPDATE")]), message: z.string() })
                        }),
                        401: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() })
                        }),
                        403: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("FORBIDDEN"), message: z.string() })
                        }),
                        404: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("TOPIC_NOT_FOUND"), message: z.string() })
                        }),
                        422: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("INVALID_LESSON_REFERENCE"), message: z.string() })
                        }),
                        500: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() })
                        })
                    }
                }
            },
            topicsController.update
        );

        // 4. Delete Topic
        adminRouter.delete(
            "/api/v1/admin/topics/:id",
            {
                schema: {
                    tags: ["Admin Topics"],
                    summary: "Delete Topic (Admin)",
                    description: "Permanently deletes a topic and its vocabulary associations.",
                    params: deleteTopicParamsSchema,
                    response: {
                        200: deleteTopicResponseSchema,
                        400: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() })
                        }),
                        401: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() })
                        }),
                        403: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("FORBIDDEN"), message: z.string() })
                        }),
                        404: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("TOPIC_NOT_FOUND"), message: z.string() })
                        }),
                        500: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() })
                        })
                    }
                }
            },
            topicsController.delete
        );

        // 5. Add Vocabulary to Topic
        adminRouter.post(
            "/api/v1/admin/topics/:id/vocabularies",
            {
                schema: {
                    tags: ["Admin Topics"],
                    summary: "Add Vocabulary to Topic (Admin)",
                    description: "Attaches an existing vocabulary item to a topic.",
                    params: addVocabularyParamsSchema,
                    body: addVocabularyBodySchema,
                    response: {
                        201: addVocabularyResponseSchema,
                        400: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() })
                        }),
                        401: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() })
                        }),
                        403: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("FORBIDDEN"), message: z.string() })
                        }),
                        404: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("TOPIC_NOT_FOUND"), message: z.string() })
                        }),
                        409: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("VOCABULARY_ALREADY_IN_TOPIC"), message: z.string() })
                        }),
                        422: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("INVALID_VOCABULARY_REFERENCE"), message: z.string() })
                        }),
                        500: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() })
                        })
                    }
                }
            },
            topicsController.addVocabulary
        );

        // 6. Remove Vocabulary from Topic
        adminRouter.delete(
            "/api/v1/admin/topics/:id/vocabularies/:vocabularyId",
            {
                schema: {
                    tags: ["Admin Topics"],
                    summary: "Remove Vocabulary from Topic (Admin)",
                    description: "Detaches a vocabulary item from a topic.",
                    params: removeVocabularyParamsSchema,
                    response: {
                        200: removeVocabularyResponseSchema,
                        400: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() })
                        }),
                        401: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() })
                        }),
                        403: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("FORBIDDEN"), message: z.string() })
                        }),
                        500: z.object({
                            success: z.boolean(),
                            error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() })
                        })
                    }
                }
            },
            topicsController.removeVocabulary
        );
    });
}
