import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyToken } from "../utils/jwt.js";
import { authRepository } from "../../modules/auth/auth.repository.js";

export async function adminGuard(request: FastifyRequest, reply: FastifyReply) {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return reply.code(401).send({
                success: false,
                error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." },
            });
        }
        const token = authHeader.split(" ")[1];
        if (!token) {
            return reply.code(401).send({
                success: false,
                error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." },
            });
        }

        const decoded = verifyToken(token) as { sub: string; role: string };
        if (decoded.role !== "admin") {
            return reply.code(403).send({
                success: false,
                error: { code: "FORBIDDEN", message: "You do not have permission to access this resource." },
            });
        }

        const user = await authRepository.findUserById(decoded.sub);
        if (!user || user.status !== "active") {
            return reply.code(403).send({
                success: false,
                error: { code: "FORBIDDEN", message: "You do not have permission to access this resource." },
            });
        }

        request.user = {
            id: user.id,
            role: user.role,
        };
    } catch (error) {
        return reply.code(401).send({
            success: false,
            error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." },
        });
    }
}
