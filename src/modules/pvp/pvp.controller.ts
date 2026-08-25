import type { FastifyReply, FastifyRequest } from "fastify";
import { pvpService, PVPError } from "./pvp.service.js";
import type { GetMatchHistoryQueryInput, RecordMatchBodyInput, GetLeaderboardQueryInput } from "./pvp.schema.js";

export const pvpController = {
    async getMyStatistics(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user!.id;
            const data = await pvpService.getMyStatistics(userId);
            return reply.status(200).send({
                success: true,
                data,
            });
        } catch (error: any) {
            if (error instanceof PVPError) {
                return reply.status(error.statusCode).send({
                    success: false,
                    error: { code: error.code, message: error.message },
                });
            }
            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred. Please try again later." },
            });
        }
    },

    async getMatchHistory(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user!.id;
            const query = request.query as GetMatchHistoryQueryInput;
            const result = await pvpService.getMatchHistory(userId, query);

            return reply.status(200).send({
                success: true,
                data: result.data,
                meta: result.meta,
            });
        } catch (error: any) {
            if (error instanceof PVPError) {
                return reply.status(error.statusCode).send({
                    success: false,
                    error: { code: error.code, message: error.message },
                });
            }
            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred. Please try again later." },
            });
        }
    },

    async recordMatch(request: FastifyRequest, reply: FastifyReply) {
        try {
            const body = request.body as RecordMatchBodyInput;
            const result = await pvpService.recordMatch(body);

            return reply.status(201).send({
                success: true,
                data: result,
                message: "Match recorded.",
            });
        } catch (error: any) {
            if (error instanceof PVPError) {
                return reply.status(error.statusCode).send({
                    success: false,
                    error: { code: error.code, message: error.message },
                });
            }
            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: error.message || "An unexpected error occurred. Please try again later." },
            });
        }
    },

    async getLeaderboard(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user!.id;
            const query = request.query as GetLeaderboardQueryInput;
            const limit = query?.limit ?? 50;

            const result = await pvpService.getLeaderboard(userId, limit);

            return reply.status(200).send({
                success: true,
                data: result,
            });
        } catch (error: any) {
            if (error instanceof PVPError) {
                return reply.status(error.statusCode).send({
                    success: false,
                    error: { code: error.code, message: error.message },
                });
            }
            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred. Please try again later." },
            });
        }
    },
};
