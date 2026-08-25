import type { FastifyReply, FastifyRequest } from "fastify";
import { vocabulariesService } from "./vocabularies.service.js";

export const vocabulariesController = {
    async list(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            const filters = request.query as any;
            const result = await vocabulariesService.list(userId, filters);
            return reply.status(200).send(result);
        } catch (error: any) {
            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: error.message }
            });
        }
    },

    async getDetail(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            const { id } = request.params as { id: string };
            const result = await vocabulariesService.getDetail(id, userId);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error.message === "VOCABULARY_NOT_FOUND") {
                return reply.status(404).send({
                    success: false,
                    error: { code: "VOCABULARY_NOT_FOUND", message: "Vocabulary not found." }
                });
            }
            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: error.message }
            });
        }
    },

    async create(request: FastifyRequest, reply: FastifyReply) {
        try {
            const adminId = request.user!.id;
            const dto = request.body as any;
            const result = await vocabulariesService.create(adminId, dto);
            return reply.status(201).send(result);
        } catch (error: any) {
            if (error.message === "DUPLICATE_VOCABULARY") {
                return reply.status(409).send({
                    success: false,
                    error: { code: "DUPLICATE_VOCABULARY", message: "This word already exists for this JLPT level." }
                });
            }
            if (error.message === "INVALID_LESSON_REFERENCE" || error.message === "INVALID_TOPIC_REFERENCE") {
                return reply.status(422).send({
                    success: false,
                    error: { code: error.message, message: "Invalid reference." }
                });
            }
            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: error.message }
            });
        }
    },

    async update(request: FastifyRequest, reply: FastifyReply) {
        try {
            const adminId = request.user!.id;
            const { id } = request.params as { id: string };
            const dto = request.body as any;
            const result = await vocabulariesService.update(adminId, id, dto);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error.message === "VOCABULARY_NOT_FOUND") {
                return reply.status(404).send({
                    success: false,
                    error: { code: "VOCABULARY_NOT_FOUND", message: "Vocabulary not found." }
                });
            }
            if (error.message === "EMPTY_UPDATE") {
                return reply.status(400).send({
                    success: false,
                    error: { code: "EMPTY_UPDATE", message: "No fields supplied." }
                });
            }
            if (error.message === "DUPLICATE_VOCABULARY") {
                return reply.status(409).send({
                    success: false,
                    error: { code: "DUPLICATE_VOCABULARY", message: "This word already exists for this JLPT level." }
                });
            }
            if (error.message === "INVALID_LESSON_REFERENCE" || error.message === "INVALID_TOPIC_REFERENCE") {
                return reply.status(422).send({
                    success: false,
                    error: { code: error.message, message: "Invalid reference." }
                });
            }
            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: error.message }
            });
        }
    },

    async delete(request: FastifyRequest, reply: FastifyReply) {
        try {
            const adminId = request.user!.id;
            const { id } = request.params as { id: string };
            const result = await vocabulariesService.delete(adminId, id);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error.message === "VOCABULARY_NOT_FOUND") {
                return reply.status(404).send({
                    success: false,
                    error: { code: "VOCABULARY_NOT_FOUND", message: "Vocabulary not found." }
                });
            }
            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: error.message }
            });
        }
    }
};
