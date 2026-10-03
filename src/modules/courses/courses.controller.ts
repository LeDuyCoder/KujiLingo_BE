import type { FastifyReply, FastifyRequest } from "fastify";
import * as coursesService from "./courses.service.js";
import type { ListCoursesQuery, CourseIdParams, CreateCourseBody, UpdateCourseBody } from "./courses.schema.js";
import { log } from "../../common/utils/log.js";

export async function listCoursesHandler(
    request: FastifyRequest<{ Querystring: ListCoursesQuery }>,
    reply: FastifyReply
) {
    try {
        const result = await coursesService.listCourses(request.query);
        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);
        return reply.code(500).send({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred. Please try again later.",
            },
        });
    }
}

export async function getCourseDetailHandler(
    request: FastifyRequest<{ Params: CourseIdParams }>,
    reply: FastifyReply
) {
    try {
        const { id } = request.params;
        const result = await coursesService.getCourseDetail(id);
        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);
        if (error.message === "COURSE_NOT_FOUND") {
            return reply.code(404).send({
                success: false,
                error: {
                    code: "COURSE_NOT_FOUND",
                    message: "Course not found.",
                },
            });
        }
        return reply.code(500).send({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred. Please try again later.",
            },
        });
    }
}

export async function createCourseHandler(
    request: FastifyRequest<{ Body: CreateCourseBody }>,
    reply: FastifyReply
) {
    try {
        const adminId = request.user!.id;
        const result = await coursesService.createCourse(adminId, request.body);
        return reply.code(201).send(result);
    } catch (error: any) {
        log.error(error);
        return reply.code(500).send({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred. Please try again later.",
            },
        });
    }
}

export async function updateCourseHandler(
    request: FastifyRequest<{ Params: CourseIdParams; Body: UpdateCourseBody }>,
    reply: FastifyReply
) {
    try {
        const adminId = request.user!.id;
        const { id } = request.params;
        const result = await coursesService.updateCourse(adminId, id, request.body);
        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);
        if (error.message === "COURSE_NOT_FOUND") {
            return reply.code(404).send({
                success: false,
                error: {
                    code: "COURSE_NOT_FOUND",
                    message: "Course not found.",
                },
            });
        }
        return reply.code(500).send({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred. Please try again later.",
            },
        });
    }
}

export async function deleteCourseHandler(
    request: FastifyRequest<{ Params: CourseIdParams }>,
    reply: FastifyReply
) {
    try {
        const adminId = request.user!.id;
        const { id } = request.params;
        const result = await coursesService.deleteCourse(adminId, id);
        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);
        if (error.message === "COURSE_NOT_FOUND") {
            return reply.code(404).send({
                success: false,
                error: {
                    code: "COURSE_NOT_FOUND",
                    message: "Course not found.",
                },
            });
        }
        if (error.message === "COURSE_NOT_EMPTY") {
            return reply.code(409).send({
                success: false,
                error: {
                    code: "COURSE_NOT_EMPTY",
                    message: "Delete all lessons in this course before deleting it.",
                },
            });
        }
        return reply.code(500).send({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred. Please try again later.",
            },
        });
    }
}

export async function restoreCourseHandler(
    request: FastifyRequest<{ Params: CourseIdParams }>,
    reply: FastifyReply
) {
    try {
        const adminId = request.user!.id;
        const { id } = request.params;
        const result = await coursesService.restoreCourse(adminId, id);
        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);
        if (error.message === "COURSE_NOT_FOUND") {
            return reply.code(404).send({
                success: false,
                error: {
                    code: "COURSE_NOT_FOUND",
                    message: "Course not found.",
                },
            });
        }
        return reply.code(500).send({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred. Please try again later.",
            },
        });
    }
}
