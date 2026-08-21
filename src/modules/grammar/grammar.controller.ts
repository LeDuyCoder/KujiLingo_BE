import type { FastifyReply, FastifyRequest } from "fastify";
import { grammarService, GrammarCustomError } from "./grammar.service.js";
import type { CreateGrammarDto, ListGrammarQuery, UpdateGrammarDto } from "./grammar.types.js";

export const grammarController = {
    async list(
        request: FastifyRequest<{ Querystring: ListGrammarQuery }>,
        reply: FastifyReply
    ) {
        try {
            const userId = request.user?.id;
            const result = await grammarService.listGrammarPoints(request.query, userId);
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

    async getById(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        try {
            const userId = request.user?.id;
            const result = await grammarService.getGrammarDetail(request.params.id, userId);
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

    async create(
        request: FastifyRequest<{ Body: CreateGrammarDto }>,
        reply: FastifyReply
    ) {
        try {
            const adminId = request.user?.id || "admin-id";
            const result = await grammarService.createGrammarPoint(adminId, request.body);
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

    async update(
        request: FastifyRequest<{ Params: { id: string }; Body: UpdateGrammarDto }>,
        reply: FastifyReply
    ) {
        try {
            const adminId = request.user?.id || "admin-id";
            const result = await grammarService.updateGrammarPoint(
                adminId,
                request.params.id,
                request.body
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

    async delete(
        request: FastifyRequest<{ Params: { id: string } }>,
        reply: FastifyReply
    ) {
        try {
            const adminId = request.user?.id || "admin-id";
            const result = await grammarService.deleteGrammarPoint(adminId, request.params.id);
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
