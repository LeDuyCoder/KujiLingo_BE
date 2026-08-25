import type { FastifyRequest, FastifyReply } from "fastify";
import { getStats } from "./statistics.service.js";

export async function getStatisticsHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const userId = request.user!.id;
        const stats = await getStats(userId);
        return reply.status(200).send({
            success: true,
            data: stats,
        });
    } catch (error: any) {
        request.log.error(error);
        if (error.message === "User not found") {
            return reply.status(404).send({
                success: false,
                error: {
                    code: "NOT_FOUND",
                    message: error.message,
                },
            });
        }
        return reply.status(500).send({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred. Please try again later.",
            },
        });
    }
}
