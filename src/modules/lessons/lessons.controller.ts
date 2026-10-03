import type { FastifyReply, FastifyRequest } from "fastify";
import { lessonsService } from "./lessons.service.js";
import type { CreateLessonBody, UpdateLessonBody } from "./lessons.types.js";

export const lessonsController = {
    /**
     * GET /api/v1/lessons/{id}
     */
    async getLessonDetail(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { id } = request.params as { id: string };
            const result = await lessonsService.getLessonDetail(id);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error.message === "LESSON_NOT_FOUND") {
                return reply.status(404).send({
                    success: false,
                    error: {
                        code: "LESSON_NOT_FOUND",
                        message: "Lesson not found."
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

    /**
     * POST /api/v1/admin/lessons (Admin only)
     */
    async create(request: FastifyRequest, reply: FastifyReply) {
        try {
            const adminId = request.user?.id;
            if (!adminId) {
                return reply.status(401).send({
                    success: false,
                    error: {
                        code: "UNAUTHORIZED",
                        message: "Access token is missing, invalid, or expired."
                    }
                });
            }

            const body = request.body as CreateLessonBody;
            
            // Reconstruct dynamically to avoid "exactOptionalPropertyTypes: true" TS errors
            const createParams: CreateLessonBody = {
                course_id: body.course_id,
                title: body.title
            };
            if (body.description !== undefined) {
                createParams.description = body.description;
            }
            if (body.order_no !== undefined) {
                createParams.order_no = body.order_no;
            }

            const result = await lessonsService.createLesson(adminId, createParams);
            return reply.status(201).send(result);
        } catch (error: any) {
            if (error.message === "INVALID_COURSE_REFERENCE") {
                return reply.status(422).send({
                    success: false,
                    error: {
                        code: "INVALID_COURSE_REFERENCE",
                        message: "The specified course does not exist."
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

    /**
     * PUT /api/v1/admin/lessons/{id} (Admin only)
     */
    async update(request: FastifyRequest, reply: FastifyReply) {
        try {
            const adminId = request.user?.id;
            if (!adminId) {
                return reply.status(401).send({
                    success: false,
                    error: {
                        code: "UNAUTHORIZED",
                        message: "Access token is missing, invalid, or expired."
                    }
                });
            }

            const { id } = request.params as { id: string };
            const body = request.body as UpdateLessonBody;

            const updateParams: UpdateLessonBody = {};
            if (body.course_id !== undefined) updateParams.course_id = body.course_id;
            if (body.title !== undefined) updateParams.title = body.title;
            if (body.description !== undefined) updateParams.description = body.description;
            if (body.order_no !== undefined) updateParams.order_no = body.order_no;

            const result = await lessonsService.updateLesson(adminId, id, updateParams);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error.message === "LESSON_NOT_FOUND") {
                return reply.status(404).send({
                    success: false,
                    error: {
                        code: "LESSON_NOT_FOUND",
                        message: "Lesson not found."
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
            if (error.message === "INVALID_COURSE_REFERENCE") {
                return reply.status(422).send({
                    success: false,
                    error: {
                        code: "INVALID_COURSE_REFERENCE",
                        message: "The specified course does not exist."
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

    /**
     * DELETE /api/v1/admin/lessons/{id} (Admin only)
     */
    async delete(request: FastifyRequest, reply: FastifyReply) {
        try {
            const adminId = request.user?.id;
            if (!adminId) {
                return reply.status(401).send({
                    success: false,
                    error: {
                        code: "UNAUTHORIZED",
                        message: "Access token is missing, invalid, or expired."
                    }
                });
            }

            const { id } = request.params as { id: string };
            const result = await lessonsService.deleteLesson(adminId, id);
            return reply.status(200).send(result);
        } catch (error: any) {
            if (error.message === "LESSON_NOT_FOUND") {
                return reply.status(404).send({
                    success: false,
                    error: {
                        code: "LESSON_NOT_FOUND",
                        message: "Lesson not found."
                    }
                });
            }
            if (error.message === "LESSON_NOT_EMPTY") {
                return reply.status(409).send({
                    success: false,
                    error: {
                        code: "LESSON_NOT_EMPTY",
                        message: "Lesson still has child topics."
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
