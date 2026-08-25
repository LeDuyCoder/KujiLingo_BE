import type { FastifyReply, FastifyRequest } from "fastify";

export async function internalKeyGuard(request: FastifyRequest, reply: FastifyReply) {
    const internalKey = request.headers["x-internal-key"];
    const expectedKey = process.env.PVP_INTERNAL_KEY || "kujilingo_pvp_internal_secret_key_2026";

    if (!internalKey || internalKey !== expectedKey) {
        return reply.code(401).send({
            success: false,
            error: {
                code: "INVALID_INTERNAL_KEY",
                message: "X-Internal-Key is missing or invalid.",
            },
        });
    }
}
