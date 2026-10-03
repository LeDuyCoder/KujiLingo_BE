import type { FastifyReply, FastifyRequest } from "fastify";
import { topicsService } from "./topics.service.js";
import { verifyToken } from "../../common/utils/jwt.js";
import type { CreateTopicBody, UpdateTopicBody, AddVocabularyBody } from "./topics.types.js";

export const topicsController = {
    /**
     * GET /api/v1/topics/{id} (Bearer optional)
     */
    async getTopicDetail(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = request.params as { id: string };

            // Retrieve accept-language locale (default to "vi")
            const rawLang = request.headers["accept-language"];
            const acceptLanguage = Array.isArray(rawLang) ? rawLang[0] : rawLang;
            const language = (acceptLanguage || "vi").split(",")[0]?.split("-")[0]?.trim().toLowerCase() || "vi";

            // Resolve Bearer Token optionally for personalization
            let userId: string | null = null;
            const authHeader = request.headers.authorization;
            if (authHeader && authHeader.startsWith("Bearer ")) {
                const token = authHeader.split(" ")[1];
                if (token) {
                    try {
                        const decoded = verifyToken(token) as { sub: string };
                        userId = decoded.sub;
                    } catch (e) {
                        // ignore and treat as guest
                    }
                }
            }

            const result = await topicsService.getTopicDetail(id, userId, language);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error.message === "TOPIC_NOT_FOUND") {
                return reply.status(404).send({
                    success: false,
                    error: {
                        code: "TOPIC_NOT_FOUND",
                        message: "Topic not found."
                    }
                });
            }

            return reply.status(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: error.message || "An unexpected error occurred."
                }
            });
        }
    },

    /**
     * POST /api/v1/admin/topics (Admin only)
     */
    async create(request: FastifyRequest, reply: FastifyReply) {
        try {
            const adminId = request.user?.id;
            if (!adminId) {
                return reply.status(401).send({
                    success: false,
                    error: {
                        code: "UNAUTHORIZED",
                        message: "Access token is missing, invalid, or expired."
                    }
                });
            }

            const body = request.body as CreateTopicBody;
            const createParams: CreateTopicBody = {
                lesson_id: body.lesson_id,
                title: body.title
            };
            if (body.description !== undefined) createParams.description = body.description;
            if (body.image !== undefined) createParams.image = body.image;
            if (body.order_no !== undefined) createParams.order_no = body.order_no;

            const result = await topicsService.createTopic(adminId, createParams);
            return reply.status(201).send(result);
        } catch (error: any) {
            if (error.message === "INVALID_LESSON_REFERENCE") {
                return reply.status(422).send({
                    success: false,
                    error: {
                        code: "INVALID_LESSON_REFERENCE",
                        message: "The specified lesson does not exist."
                    }
                });
            }

            return reply.status(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: error.message || "An unexpected error occurred."
                }
            });
        }
    },

    /**
     * PUT /api/v1/admin/topics/{id} (Admin only)
     */
    async update(request: FastifyRequest, reply: FastifyReply) {
        try {
            const adminId = request.user?.id;
            if (!adminId) {
                return reply.status(401).send({
                    success: false,
                    error: {
                        code: "UNAUTHORIZED",
                        message: "Access token is missing, invalid, or expired."
                    }
                });
            }

            const { id } = request.params as { id: string };
            const body = request.body as UpdateTopicBody;

            const updateParams: UpdateTopicBody = {};
            if (body.lesson_id !== undefined) updateParams.lesson_id = body.lesson_id;
            if (body.title !== undefined) updateParams.title = body.title;
            if (body.description !== undefined) updateParams.description = body.description;
            if (body.image !== undefined) updateParams.image = body.image;
            if (body.order_no !== undefined) updateParams.order_no = body.order_no;

            const result = await topicsService.updateTopic(adminId, id, updateParams);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error.message === "TOPIC_NOT_FOUND") {
                return reply.status(404).send({
                    success: false,
                    error: {
                        code: "TOPIC_NOT_FOUND",
                        message: "Topic not found."
                    }
                });
            }
            if (error.message === "EMPTY_UPDATE") {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: "EMPTY_UPDATE",
                        message: "No fields supplied."
                    }
                });
            }
            if (error.message === "INVALID_LESSON_REFERENCE") {
                return reply.status(422).send({
                    success: false,
                    error: {
                        code: "INVALID_LESSON_REFERENCE",
                        message: "The specified lesson does not exist."
                    }
                });
            }

            return reply.status(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: error.message || "An unexpected error occurred."
                }
            });
        }
    },

    /**
     * DELETE /api/v1/admin/topics/{id} (Admin only)
     */
    async delete(request: FastifyRequest, reply: FastifyReply) {
        try {
            const adminId = request.user?.id;
            if (!adminId) {
                return reply.status(401).send({
                    success: false,
                    error: {
                        code: "UNAUTHORIZED",
                        message: "Access token is missing, invalid, or expired."
                    }
                });
            }

            const { id } = request.params as { id: string };
            const result = await topicsService.deleteTopic(adminId, id);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error.message === "TOPIC_NOT_FOUND") {
                return reply.status(404).send({
                    success: false,
                    error: {
                        code: "TOPIC_NOT_FOUND",
                        message: "Topic not found."
                    }
                });
            }

            return reply.status(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: error.message || "An unexpected error occurred."
                }
            });
        }
    },

    /**
     * POST /api/v1/admin/topics/{id}/vocabularies (Admin only)
     */
    async addVocabulary(request: FastifyRequest, reply: FastifyReply) {
        try {
            const adminId = request.user?.id;
            if (!adminId) {
                return reply.status(401).send({
                    success: false,
                    error: {
                        code: "UNAUTHORIZED",
                        message: "Access token is missing, invalid, or expired."
                    }
                });
            }

            const { id } = request.params as { id: string };
            const body = request.body as AddVocabularyBody;

            const result = await topicsService.addVocabulary(adminId, id, {
                vocabulary_id: body.vocabulary_id
            });
            return reply.status(201).send(result);
        } catch (error: any) {
            if (error.message === "TOPIC_NOT_FOUND") {
                return reply.status(404).send({
                    success: false,
                    error: {
                        code: "TOPIC_NOT_FOUND",
                        message: "Topic not found."
                    }
                });
            }
            if (error.message === "INVALID_VOCABULARY_REFERENCE") {
                return reply.status(422).send({
                    success: false,
                    error: {
                        code: "INVALID_VOCABULARY_REFERENCE",
                        message: "Vocabulary not found."
                    }
                });
            }
            if (error.message === "VOCABULARY_ALREADY_IN_TOPIC") {
                return reply.status(409).send({
                    success: false,
                    error: {
                        code: "VOCABULARY_ALREADY_IN_TOPIC",
                        message: "Vocabulary already attached to this topic."
                    }
                });
            }

            return reply.status(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: error.message || "An unexpected error occurred."
                }
            });
        }
    },

    /**
     * DELETE /api/v1/admin/topics/{id}/vocabularies/{vocabularyId} (Admin only)
     */
    async removeVocabulary(request: FastifyRequest, reply: FastifyReply) {
        try {
            const adminId = request.user?.id;
            if (!adminId) {
                return reply.status(401).send({
                    success: false,
                    error: {
                        code: "UNAUTHORIZED",
                        message: "Access token is missing, invalid, or expired."
                    }
                });
            }

            const { id, vocabularyId } = request.params as { id: string; vocabularyId: string };
            const result = await topicsService.removeVocabulary(adminId, id, vocabularyId);
            return reply.status(200).send(result);
        } catch (error: any) {
            return reply.status(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: error.message || "An unexpected error occurred."
                }
            });
        }
    }
};
