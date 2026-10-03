import type { FastifyReply, FastifyRequest } from "fastify";
import { learningProgressService } from "./learning-progress.service.js";
import type {
    GetDueReviewQueueQuery,
    SubmitVocabularyReviewBody,
    GetReviewHistoryQuery
} from "./learning-progress.types.js";

export const learningProgressController = {
    /**
     * GET /api/v1/learning-progress
     */
    async getOverview(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            if (!userId) {
                return reply.status(401).send({
                    success: false,
                    error: {
                        code: "UNAUTHORIZED",
                        message: "Access token is missing, invalid, or expired."
                    }
                });
            }

            const result = await learningProgressService.getOverview(userId);
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
    },

    /**
     * GET /api/v1/learning-progress/due
     */
    async getDueQueue(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            if (!userId) {
                return reply.status(401).send({
                    success: false,
                    error: {
                        code: "UNAUTHORIZED",
                        message: "Access token is missing, invalid, or expired."
                    }
                });
            }

            const query = request.query as GetDueReviewQueueQuery;

            const rawLang = request.headers["accept-language"];
            const acceptLanguage = Array.isArray(rawLang) ? rawLang[0] : rawLang;
            const language = (acceptLanguage || "vi").split(",")[0]?.split("-")[0]?.trim().toLowerCase() || "vi";

            const dueFilters: { limit: number; jlpt?: "N5" | "N4" | "N3" | "N2" | "N1"; status?: "NEW" | "LEARNING" | "REVIEWING" | "MASTERED" } = {
                limit: query.limit
            };
            if (query.jlpt !== undefined) {
                dueFilters.jlpt = query.jlpt;
            }
            if (query.status !== undefined) {
                dueFilters.status = query.status;
            }

            const result = await learningProgressService.getDueQueue(userId, dueFilters, language);
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
    },

    /**
     * POST /api/v1/learning-progress/review
     */
    async submitReview(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            if (!userId) {
                return reply.status(401).send({
                    success: false,
                    error: {
                        code: "UNAUTHORIZED",
                        message: "Access token is missing, invalid, or expired."
                    }
                });
            }

            const body = request.body as SubmitVocabularyReviewBody;
            const reviewParams: { vocabulary_id: string; correct: boolean; duration?: number } = {
                vocabulary_id: body.vocabulary_id,
                correct: body.correct
            };
            if (body.duration !== undefined) {
                reviewParams.duration = body.duration;
            }

            const result = await learningProgressService.submitReview(userId, reviewParams);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error.message === "INVALID_VOCABULARY_REFERENCE") {
                return reply.status(422).send({
                    success: false,
                    error: {
                        code: "INVALID_VOCABULARY_REFERENCE",
                        message: "Vocabulary not found."
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
     * GET /api/v1/learning-progress/history
     */
    async getHistory(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            if (!userId) {
                return reply.status(401).send({
                    success: false,
                    error: {
                        code: "UNAUTHORIZED",
                        message: "Access token is missing, invalid, or expired."
                    }
                });
            }

            const query = request.query as GetReviewHistoryQuery;

            // Simple date range check before service call to protect service
            if (new Date(query.end_date) < new Date(query.start_date)) {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "end_date must not precede start_date."
                    }
                });
            }

            const result = await learningProgressService.getHistory(userId, query);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error.message === "RANGE_TOO_LARGE") {
                return reply.status(422).send({
                    success: false,
                    error: {
                        code: "RANGE_TOO_LARGE",
                        message: "Range exceeds 366 days."
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
    }
};
