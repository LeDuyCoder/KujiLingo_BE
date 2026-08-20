import type { FastifyReply, FastifyRequest } from "fastify";
import * as adminService from "./admin.service.js";
import type { ListUsersQuery, UserParams, UpdateUserStatusBody, UpdateUserRoleBody, ListAuditLogsQuery } from "./admin.schema.js";
import { log } from "../../common/utils/log.js";

export async function listUsersHandler(
    request: FastifyRequest<{ Querystring: ListUsersQuery }>,
    reply: FastifyReply
) {
    try {
        const result = await adminService.listUsers(request.query);
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

export async function getUserDetailHandler(
    request: FastifyRequest<{ Params: UserParams }>,
    reply: FastifyReply
) {
    try {
        const { id } = request.params;
        const result = await adminService.getUserDetail(id);
        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);
        if (error.message === "USER_NOT_FOUND") {
            return reply.code(404).send({
                success: false,
                error: {
                    code: "USER_NOT_FOUND",
                    message: "No matching user.",
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

export async function updateUserStatusHandler(
    request: FastifyRequest<{ Params: UserParams; Body: UpdateUserStatusBody }>,
    reply: FastifyReply
) {
    try {
        const adminId = request.user!.id;
        const { id } = request.params;
        const { status, reason } = request.body;

        const result = await adminService.updateUserStatus({
            adminId,
            userId: id,
            status,
            reason,
        });

        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);
        if (error.message === "CANNOT_MODIFY_SELF") {
            return reply.code(422).send({
                success: false,
                error: {
                    code: "CANNOT_MODIFY_SELF",
                    message: "Admin cannot change their own status.",
                },
            });
        }
        if (error.message === "USER_NOT_FOUND") {
            return reply.code(404).send({
                success: false,
                error: {
                    code: "USER_NOT_FOUND",
                    message: "No matching user.",
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

export async function updateUserRoleHandler(
    request: FastifyRequest<{ Params: UserParams; Body: UpdateUserRoleBody }>,
    reply: FastifyReply
) {
    try {
        const adminId = request.user!.id;
        const { id } = request.params;
        const { role } = request.body;

        const result = await adminService.updateUserRole({
            adminId,
            userId: id,
            role,
        });

        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);
        if (error.message === "CANNOT_MODIFY_SELF") {
            return reply.code(422).send({
                success: false,
                error: {
                    code: "CANNOT_MODIFY_SELF",
                    message: "Admin cannot change their own role.",
                },
            });
        }
        if (error.message === "USER_NOT_FOUND") {
            return reply.code(404).send({
                success: false,
                error: {
                    code: "USER_NOT_FOUND",
                    message: "No matching user.",
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

export async function listAuditLogsHandler(
    request: FastifyRequest<{ Querystring: ListAuditLogsQuery }>,
    reply: FastifyReply
) {
    try {
        const result = await adminService.listAuditLogs(request.query);
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
