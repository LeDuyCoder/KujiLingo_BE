import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import crypto from "node:crypto";

type TransactionClient = Prisma.TransactionClient;

/**
 * Tìm kiếm danh sách người dùng có lọc và phân trang
 */
export async function findFilteredUsers(params: {
    status?: string | undefined;
    role?: string | undefined;
    search?: string | undefined;
    page: number;
    limit: number;
}) {
    const { status, role, search, page, limit } = params;
    const where: Prisma.usersWhereInput = {
        deleted_at: null,
    };

    if (status) {
        where.status = status;
    }

    if (role) {
        where.role = role;
    }

    if (search) {
        where.OR = [
            { email: { contains: search, mode: "insensitive" } },
            { display_name: { contains: search, mode: "insensitive" } },
        ];
    }

    return prisma.users.findMany({
        where,
        select: {
            id: true,
            email: true,
            display_name: true,
            avatar: true,
            level: true,
            exp: true,
            streak: true,
            role: true,
            status: true,
            created_at: true,
        },
        orderBy: {
            created_at: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
    });
}

/**
 * Đếm tổng số người dùng khớp bộ lọc
 */
export async function countFilteredUsers(params: {
    status?: string | undefined;
    role?: string | undefined;
    search?: string | undefined;
}) {
    const { status, role, search } = params;
    const where: Prisma.usersWhereInput = {
        deleted_at: null,
    };

    if (status) {
        where.status = status;
    }

    if (role) {
        where.role = role;
    }

    if (search) {
        where.OR = [
            { email: { contains: search, mode: "insensitive" } },
            { display_name: { contains: search, mode: "insensitive" } },
        ];
    }

    return prisma.users.count({ where });
}

/**
 * Lấy số lượng review của người dùng
 */
export async function countUserReviews(userId: string): Promise<number> {
    return prisma.review_histories.count({
        where: { user_id: userId },
    });
}

/**
 * Lấy thống kê PVP của người dùng
 */
export async function findUserPvpStatistics(userId: string) {
    return prisma.user_pvp_statistics.findUnique({
        where: { user_id: userId },
    });
}

/**
 * Tìm người dùng theo ID (không phân biệt trạng thái)
 */
export async function findUserById(id: string) {
    return prisma.users.findFirst({
        where: { id, deleted_at: null },
    });
}

/**
 * Cập nhật vai trò (role) của người dùng
 */
export async function updateUserRole(tx: TransactionClient, userId: string, role: string) {
    return tx.users.update({
        where: { id: userId },
        data: { role, updated_at: new Date() },
    });
}

/**
 * Cập nhật trạng thái (status) của người dùng
 */
export async function updateUserStatus(tx: TransactionClient, userId: string, status: string) {
    return tx.users.update({
        where: { id: userId },
        data: { status, updated_at: new Date() },
    });
}

/**
 * Thu hồi toàn bộ session (refresh tokens) của người dùng
 */
export async function revokeAllSessions(tx: TransactionClient, userId: string) {
    return tx.refresh_tokens.updateMany({
        where: { user_id: userId, is_revoked: false },
        data: { is_revoked: true },
    });
}

/**
 * Ghi nhận log kiểm toán của Admin
 */
export async function createAuditLog(
    tx: TransactionClient,
    data: {
        adminId: string;
        action: string;
        entityId?: string | undefined;
        beforeState?: any | undefined;
        afterState?: any | undefined;
    }
) {
    return tx.admin_audit_logs.create({
        data: {
            id: crypto.randomUUID(),
            admin_id: data.adminId,
            action: data.action,
            entity_id: data.entityId ?? null,
            before_state: data.beforeState ?? null,
            after_state: data.afterState ?? null,
        },
    });
}

/**
 * Tìm kiếm danh sách log kiểm toán có lọc và phân trang
 */
export async function findAuditLogs(params: {
    adminId?: string | undefined;
    action?: string | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    page: number;
    limit: number;
}) {
    const { adminId, action, startDate, endDate, page, limit } = params;
    const where: Prisma.admin_audit_logsWhereInput = {};

    if (adminId) {
        where.admin_id = adminId;
    }

    if (action) {
        where.action = {
            startsWith: action,
            mode: "insensitive",
        };
    }

    if (startDate || endDate) {
        where.created_at = {};
        if (startDate) {
            where.created_at.gte = startDate;
        }
        if (endDate) {
            where.created_at.lte = endDate;
        }
    }

    return prisma.admin_audit_logs.findMany({
        where,
        include: {
            users: {
                select: {
                    display_name: true,
                },
            },
        },
        orderBy: {
            created_at: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
    });
}

/**
 * Đếm tổng số log kiểm toán khớp bộ lọc
 */
export async function countAuditLogs(params: {
    adminId?: string | undefined;
    action?: string | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
}) {
    const { adminId, action, startDate, endDate } = params;
    const where: Prisma.admin_audit_logsWhereInput = {};

    if (adminId) {
        where.admin_id = adminId;
    }

    if (action) {
        where.action = {
            startsWith: action,
            mode: "insensitive",
        };
    }

    if (startDate || endDate) {
        where.created_at = {};
        if (startDate) {
            where.created_at.gte = startDate;
        }
        if (endDate) {
            where.created_at.lte = endDate;
        }
    }

    return prisma.admin_audit_logs.count({ where });
}

export const adminRepository = {
    findFilteredUsers,
    countFilteredUsers,
    countUserReviews,
    findUserPvpStatistics,
    findUserById,
    updateUserRole,
    updateUserStatus,
    revokeAllSessions,
    createAuditLog,
    findAuditLogs,
    countAuditLogs,
};
