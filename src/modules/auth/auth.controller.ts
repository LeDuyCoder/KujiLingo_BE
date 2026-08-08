import type { FastifyReply, FastifyRequest } from "fastify";
import * as authService from "./auth.service.js";
import type { RegisterInput } from "./auth.schema.js";
import type { RegisterResponse } from "./auth.types.js";

export async function registerHandler(
    request: FastifyRequest<{ Body: RegisterInput }>,
    reply: FastifyReply
) {
    try {
        const result = await authService.register(request.body);
        const response: RegisterResponse = {
            code: "REGISTER_SUCCESS",
            ...result
        };
        return reply.code(201).send(response);
    } catch (error: any) {
        if (error.message === "DUPLICATE_EMAIL") {
            return reply.code(409).send({ code: "REGISTER_DUPLICATE_EMAIL" });
        }
        return reply.code(500).send({ code: "REGISTER_INTERNAL_SERVER_ERROR" });
    }
}
