import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { authGuard } from "../../common/middlewares/auth.guard.js";
import { learningProgressController } from "./learning-progress.controller.js";
import {
    getLearningProgressOverviewResponseSchema,
    getDueReviewQueueQuerySchema,
    getDueReviewQueueResponseSchema,
    submitVocabularyReviewBodySchema,
    submitVocabularyReviewResponseSchema,
    getReviewHistoryQuerySchema,
    getReviewHistoryResponseSchema
} from "./learning-progress.schema.js";

export async function learningProgressRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    // GET /api/v1/learning-progress
    router.get(
        "/api/v1/learning-progress",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["Learning Progress"],
                summary: "Get Learning Progress Overview",
                response: { 200: getLearningProgressOverviewResponseSchema }
            },
        },
        learningProgressController.getOverview
    );

    // GET /api/v1/learning-progress/due
    router.get(
        "/api/v1/learning-progress/due",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["Learning Progress"],
                summary: "Get Due Review Queue",
                querystring: getDueReviewQueueQuerySchema,
                response: { 200: getDueReviewQueueResponseSchema }
            },
        },
        learningProgressController.getDueQueue
    );

    // POST /api/v1/learning-progress/review
    router.post(
        "/api/v1/learning-progress/review",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["Learning Progress"],
                summary: "Submit Vocabulary Review",
                body: submitVocabularyReviewBodySchema,
                response: { 200: submitVocabularyReviewResponseSchema }
            },
        },
        learningProgressController.submitReview
    );

    // GET /api/v1/learning-progress/history
    router.get(
        "/api/v1/learning-progress/history",
        {
            onRequest: [authGuard],
            schema: {
                tags: ["Learning Progress"],
                summary: "Get Review History Summary",
                querystring: getReviewHistoryQuerySchema,
                response: { 200: getReviewHistoryResponseSchema }
            },
        },
        learningProgressController.getHistory
    );
}
