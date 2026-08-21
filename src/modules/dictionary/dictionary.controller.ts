import type { FastifyReply, FastifyRequest } from "fastify";
import { dictionaryService } from "./dictionary.service.js";
import { verifyToken } from "../../common/utils/jwt.js";

function getUserIdFromAuthHeader(request: FastifyRequest): string | undefined {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        if (token) {
            try {
                const decoded = verifyToken(token) as { sub: string };
                return decoded.sub;
            } catch (error) {
                // Bỏ qua lỗi giải mã vì đây là endpoint công khai
            }
        }
    }
    return undefined;
}

export async function searchHandler(request: FastifyRequest, reply: FastifyReply) {
    const { q, jlpt_level, page, limit } = request.query as any;
    const userId = getUserIdFromAuthHeader(request);
    const result = await dictionaryService.search(q, jlpt_level, page, limit, userId);
    return reply.send({ success: true, ...result });
}

export async function getDetailHandler(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as any;
    const userId = getUserIdFromAuthHeader(request);
    const result = await dictionaryService.getDetail(id, userId);
    
    if (!result) {
        return reply.code(404).send({
            success: false,
            error: {
                code: "ENTRY_NOT_FOUND",
                message: "Dictionary entry not found."
            }
        });
    }
    
    return reply.send({ success: true, data: result });
}