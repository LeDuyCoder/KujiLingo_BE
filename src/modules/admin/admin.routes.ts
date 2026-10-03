import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { adminGuard } from "../../common/middlewares/admin.guard.js";
import {
    listUsersHandler,
    getUserDetailHandler,
    updateUserStatusHandler,
    updateUserRoleHandler,
    listAuditLogsHandler,
} from "./admin.controller.js";
import {
    listUsersQuerySchema,
    userParamsSchema,
    updateUserStatusBodySchema,
    updateUserRoleBodySchema,
    listAuditLogsQuerySchema,
} from "./admin.schema.js";

export async function adminRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    // Áp dụng adminGuard cho toàn bộ các endpoint thuộc module Admin
    router.addHook("preHandler", adminGuard);

    // 1. List Users
    router.get(
        "/api/v1/admin/users",
        {
            schema: {
                tags: ["Admin"],
                summary: "List Users",
                description: "Returns a paginated, filterable list of all registered users.",
                querystring: listUsersQuerySchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.array(
                            z.object({
                                id: z.string().uuid(),
                                email: z.string().email().nullable(),
                                display_name: z.string().nullable(),
                                avatar: z.string().nullable(),
                                level: z.number().nullable(),
                                exp: z.number().nullable(),
                                streak: z.number().nullable(),
                                role: z.string(),
                                status: z.string().nullable(),
                                created_at: z.string(),
                            })
                        ),
                        meta: z.object({
                            page: z.number(),
                            limit: z.number(),
                            total: z.number(),
                            total_pages: z.number(),
                        }),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() }),
                    }),
                    403: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("FORBIDDEN"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        listUsersHandler
    );

    // 2. Get User Detail
    router.get(
        "/api/v1/admin/users/:id",
        {
            schema: {
                tags: ["Admin"],
                summary: "Get User Detail",
                description: "Returns the full admin view of a specific user, including stats and account metadata.",
                params: userParamsSchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            id: z.string().uuid(),
                            email: z.string().email().nullable(),
                            display_name: z.string().nullable(),
                            avatar: z.string().nullable(),
                            level: z.number().nullable(),
                            exp: z.number().nullable(),
                            streak: z.number().nullable(),
                            role: z.string(),
                            status: z.string().nullable(),
                            created_at: z.string(),
                            total_reviews: z.number(),
                            pvp_matches: z.number(),
                            pvp_rating: z.number(),
                        }),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() }),
                    }),
                    403: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("FORBIDDEN"), message: z.string() }),
                    }),
                    404: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("USER_NOT_FOUND"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        getUserDetailHandler
    );

    // 3. Update User Status
    router.put(
        "/api/v1/admin/users/:id/status",
        {
            schema: {
                tags: ["Admin"],
                summary: "Update User Status",
                description: "Allows an admin to change a user's account status (suspend, ban, or reactivate).",
                params: userParamsSchema,
                body: updateUserStatusBodySchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            id: z.string().uuid(),
                            status: z.string(),
                        }),
                        message: z.string(),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() }),
                    }),
                    403: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("FORBIDDEN"), message: z.string() }),
                    }),
                    404: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("USER_NOT_FOUND"), message: z.string() }),
                    }),
                    422: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("CANNOT_MODIFY_SELF"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        updateUserStatusHandler
    );

    // 4. Promote / Demote User Role
    router.put(
        "/api/v1/admin/users/:id/role",
        {
            schema: {
                tags: ["Admin"],
                summary: "Promote / Demote User Role",
                description: "Allows an admin to grant or revoke the admin role for a user.",
                params: userParamsSchema,
                body: updateUserRoleBodySchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.object({
                            id: z.string().uuid(),
                            role: z.string(),
                        }),
                        message: z.string(),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() }),
                    }),
                    403: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("FORBIDDEN"), message: z.string() }),
                    }),
                    404: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("USER_NOT_FOUND"), message: z.string() }),
                    }),
                    422: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("CANNOT_MODIFY_SELF"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        updateUserRoleHandler
    );

    // 5. Get Audit Logs
    router.get(
        "/api/v1/admin/audit-logs",
        {
            schema: {
                tags: ["Admin"],
                summary: "Get Audit Logs",
                description: "Returns a paginated, filterable audit trail of all admin-performed actions.",
                querystring: listAuditLogsQuerySchema,
                response: {
                    200: z.object({
                        success: z.boolean(),
                        data: z.array(
                            z.object({
                                id: z.string().uuid(),
                                admin_id: z.string().uuid(),
                                admin_name: z.string(),
                                action: z.string(),
                                entity_id: z.string().nullable(),
                                before_state: z.any().nullable(),
                                after_state: z.any().nullable(),
                                created_at: z.string(),
                            })
                        ),
                        meta: z.object({
                            page: z.number(),
                            limit: z.number(),
                            total: z.number(),
                            total_pages: z.number(),
                        }),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("VALIDATION_ERROR"), message: z.string() }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() }),
                    }),
                    403: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("FORBIDDEN"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        listAuditLogsHandler
    );
}
