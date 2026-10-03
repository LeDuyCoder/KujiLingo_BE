import type { FastifyReply, FastifyRequest } from "fastify";
import { grammarService, GrammarCustomError } from "./grammar.service.js";
import type { CreateGrammarDto, ListGrammarQuery, UpdateGrammarDto } from "./grammar.types.js";

export const grammarController = {
    async list(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            const result = await grammarService.listGrammarPoints((request.query as ListGrammarQuery) || {}, userId);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error instanceof GrammarCustomError) {
                return reply.status(error.statusCode).send({
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message,
                    },
                });
            }
            throw error;
        }
    },

    async getById(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            const params = request.params as { id: string };
            const result = await grammarService.getGrammarDetail(params.id, userId);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error instanceof GrammarCustomError) {
                return reply.status(error.statusCode).send({
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message,
                    },
                });
            }
            throw error;
        }
    },

    async create(request: FastifyRequest, reply: FastifyReply) {
        try {
            const adminId = request.user?.id || "admin-id";
            const result = await grammarService.createGrammarPoint(adminId, request.body as CreateGrammarDto);
            return reply.status(201).send(result);
        } catch (error: any) {
            if (error instanceof GrammarCustomError) {
                return reply.status(error.statusCode).send({
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message,
                    },
                });
            }
            throw error;
        }
    },

    async update(request: FastifyRequest, reply: FastifyReply) {
        try {
            const adminId = request.user?.id || "admin-id";
            const params = request.params as { id: string };
            const result = await grammarService.updateGrammarPoint(
                adminId,
                params.id,
                request.body as UpdateGrammarDto
            );
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error instanceof GrammarCustomError) {
                return reply.status(error.statusCode).send({
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message,
                    },
                });
            }
            throw error;
        }
    },

    async delete(request: FastifyRequest, reply: FastifyReply) {
        try {
            const adminId = request.user?.id || "admin-id";
            const params = request.params as { id: string };
            const result = await grammarService.deleteGrammarPoint(adminId, params.id);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error instanceof GrammarCustomError) {
                return reply.status(error.statusCode).send({
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message,
                    },
                });
            }
            throw error;
        }
    },
};
