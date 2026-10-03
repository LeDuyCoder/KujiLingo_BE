import type { FastifyReply, FastifyRequest } from "fastify";
import { log } from "../../common/utils/log.js";
import { getDashboardSummary } from "./dashboard.service.js";

export async function getDashboardSummaryHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const userId = request.user!.id;
        const result = await getDashboardSummary(userId);
        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);
        if (error.message === "USER_NOT_FOUND") {
            return reply.code(404).send({
                success: false,
                error: {
                    code: "USER_NOT_FOUND",
                    message: "No matching user.",
                }
            });
        }

        return reply.code(500).send({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred. Please try again later.",
            }
        })
    }
}