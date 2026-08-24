import type { FastifyReply, FastifyRequest } from "fastify";
import { srsService } from "./srs.service.js";

export const srsController = {
    /**
     * GET /api/v1/srs/due
     */
    async getDue(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            if (!userId) {
                return reply.status(401).send({
                    success: false,
                    error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." }
                });
            }

            const query = request.query as { item_type?: string; limit?: number };
            const result = await srsService.getDueCards(userId, query);
            return reply.status(200).send(result);
        } catch (error: any) {
            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: error.message || "An unexpected error occurred." }
            });
        }
    },

    /**
     * POST /api/v1/srs/cards/{cardId}/review
     */
    async submitReview(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            if (!userId) {
                return reply.status(401).send({
                    success: false,
                    error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." }
                });
            }

            const { cardId } = request.params as { cardId: string };
            const { rating } = request.body as { rating: "again" | "hard" | "good" | "easy" };

            const result = await srsService.submitReview(userId, cardId, rating);
            return reply.status(200).send(result);
        } catch (error: any) {
            const msg = error.message;
            if (msg === "CARD_NOT_FOUND") {
                return reply.status(404).send({
                    success: false,
                    error: { code: "CARD_NOT_FOUND", message: "Card not found." }
                });
            }

            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: error.message || "An unexpected error occurred." }
            });
        }
    },

    /**
     * POST /api/v1/srs/items
     */
    async addItem(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            if (!userId) {
                return reply.status(401).send({
                    success: false,
                    error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." }
                });
            }

            const { item_type, item_id } = request.body as { item_type: "vocabulary" | "kanji" | "grammar"; item_id: string };
            const result = await srsService.addItem(userId, item_type, item_id);
            return reply.status(201).send(result);
        } catch (error: any) {
            const msg = error.message;
            if (msg === "ITEM_ALREADY_IN_SRS") {
                return reply.status(409).send({
                    success: false,
                    error: { code: "ITEM_ALREADY_IN_SRS", message: "This item is already in your review queue." }
                });
            }
            if (msg === "INVALID_ITEM_REFERENCE") {
                return reply.status(422).send({
                    success: false,
                    error: { code: "INVALID_ITEM_REFERENCE", message: "The specified item does not exist." }
                });
            }

            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: error.message || "An unexpected error occurred." }
            });
        }
    }
};
