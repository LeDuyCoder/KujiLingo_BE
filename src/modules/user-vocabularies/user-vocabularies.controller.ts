import type { FastifyReply, FastifyRequest } from "fastify";
import { userVocabularyService } from "./user-vocabularies.service.js";

export const userVocabularyController = {
    async list(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user!.id;
            const { search, page, limit } = request.query as { search?: string; page?: number; limit?: number };
            const result = await userVocabularyService.list(userId, { search, page, limit });
            return reply.status(200).send(result);
        } catch (error: any) {
            return reply.status(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: error.message || "An unexpected error occurred."
                }
            });
        }
    },

    async create(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user!.id;
            const body = request.body as {
                kanji: string;
                hiragana?: string;
                romaji?: string;
                meaning: string;
                note?: string;
                image?: string;
                audio?: string;
            };
            const result = await userVocabularyService.create(userId, body);
            return reply.status(201).send(result);
        } catch (error: any) {
            return reply.status(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: error.message || "An unexpected error occurred."
                }
            });
        }
    },

    async update(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user!.id;
            const { id } = request.params as { id: string };
            const body = request.body as {
                kanji?: string;
                hiragana?: string;
                romaji?: string;
                meaning?: string;
                note?: string;
                image?: string;
                audio?: string;
            };
            const result = await userVocabularyService.update(userId, id, body);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error.message === "USER_VOCABULARY_NOT_FOUND") {
                return reply.status(404).send({
                    success: false,
                    error: {
                        code: "USER_VOCABULARY_NOT_FOUND",
                        message: "User vocabulary not found."
                    }
                });
            }
            if (error.message === "EMPTY_UPDATE") {
                return reply.status(400).send({
                    success: false,
                    error: {
                        code: "EMPTY_UPDATE",
                        message: "No fields supplied."
                    }
                });
            }
            return reply.status(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: error.message || "An unexpected error occurred."
                }
            });
        }
    },

    async delete(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user!.id;
            const { id } = request.params as { id: string };
            const result = await userVocabularyService.delete(userId, id);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error.message === "USER_VOCABULARY_NOT_FOUND") {
                return reply.status(404).send({
                    success: false,
                    error: {
                        code: "USER_VOCABULARY_NOT_FOUND",
                        message: "User vocabulary not found."
                    }
                });
            }
            return reply.status(500).send({
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: error.message || "An unexpected error occurred."
                }
            });
        }
    }
};
