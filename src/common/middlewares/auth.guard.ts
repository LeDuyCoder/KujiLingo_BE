import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyToken } from "../utils/jwt.js";
import { authRepository } from "../../modules/auth/auth.repository.js";
import { log } from "../utils/log.js";

export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
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
        const user = await authRepository.findUserById(decoded.sub);
        
        if (!user) {
            return reply.code(401).send({
                success: false,
                error: { code: "UNAUTHORIZED", message: "User does not exist." },
            });
        }

        if (user.status === "suspended") {
            return reply.code(403).send({
                success: false,
                error: { code: "ACCOUNT_SUSPENDED", message: "This account has been suspended." },
            });
        }

        if (user.status === "banned") {
            return reply.code(403).send({
                success: false,
                error: { code: "ACCOUNT_BANNED", message: "This account has been banned." },
            });
        }

        request.user = {
            id: user.id,
            role: user.role,
        };
    } catch (error: any) {
        log.error(error);
        return reply.code(401).send({
            success: false,
            error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." },
        });
    }
}
