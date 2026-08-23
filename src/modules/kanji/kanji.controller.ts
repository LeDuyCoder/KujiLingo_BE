import type { FastifyReply, FastifyRequest } from "fastify";
import { kanjiService, KanjiCustomError } from "./kanji.service.js";
import type { CreateKanjiDto, ListKanjiQuery, UpdateKanjiDto } from "./kanji.types.js";

export const kanjiController = {
    async list(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            const result = await kanjiService.listKanji((request.query as ListKanjiQuery) || {}, userId);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error instanceof KanjiCustomError) {
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
            const result = await kanjiService.getKanjiDetail(params.id, userId);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error instanceof KanjiCustomError) {
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
            const result = await kanjiService.createKanji(adminId, request.body as CreateKanjiDto);
            return reply.status(201).send(result);
        } catch (error: any) {
            if (error instanceof KanjiCustomError) {
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
            const result = await kanjiService.updateKanji(
                adminId,
                params.id,
                request.body as UpdateKanjiDto
            );
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error instanceof KanjiCustomError) {
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
            const result = await kanjiService.deleteKanji(adminId, params.id);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error instanceof KanjiCustomError) {
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
