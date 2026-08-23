import type { FastifyReply, FastifyRequest } from "fastify";
import { leaderboardService } from "./leaderboard.service.js";
import type { GetLeaderboardQuery } from "./leaderboard.types.js";

export const leaderboardController = {
    async get(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            const result = await leaderboardService.getLeaderboard(
                (request.query as GetLeaderboardQuery) || {},
                userId
            );
            return reply.status(200).send(result);
        } catch (error: any) {
            // Basic error handling - could use a centralized error handler
            return reply.status(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: error.message || "An unexpected error occurred.",
                },
            });
        }
    },
};
