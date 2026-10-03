import { db } from "../../config/prisma.js";
import { adminRepository } from "./admin.repository.js";
import type { ListUsersQuery, ListAuditLogsQuery } from "./admin.schema.js";
import type { AdminUserDTO, AdminUserDetailDTO, AuditLogDTO } from "./admin.types.js";

/**
 * Lấy danh sách người dùng có lọc và phân trang
 */
export async function listUsers(query: ListUsersQuery) {
    const users = await adminRepository.findFilteredUsers(query);
    const total = await adminRepository.countFilteredUsers(query);

    const data: AdminUserDTO[] = users.map(user => ({
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar: user.avatar,
        level: user.level,
        exp: user.exp,
        streak: user.streak,
        role: user.role,
        status: user.status,
        created_at: user.created_at ? user.created_at.toISOString() : "",
    }));

    const totalPages = Math.ceil(total / query.limit);

    return {
        success: true,
        data,
        meta: {
            page: query.page,
            limit: query.limit,
            total,
            total_pages: totalPages || 1,
        },
    };
}

/**
 * Lấy chi tiết thông tin một người dùng
 */
export async function getUserDetail(userId: string) {
    const user = await adminRepository.findUserById(userId);
    if (!user) {
        throw new Error("USER_NOT_FOUND");
    }

    const totalReviews = await adminRepository.countUserReviews(userId);
    const pvpStats = await adminRepository.findUserPvpStatistics(userId);

    const data: AdminUserDetailDTO = {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar: user.avatar,
        level: user.level,
        exp: user.exp,
        streak: user.streak,
        role: user.role,
        status: user.status,
        created_at: user.created_at ? user.created_at.toISOString() : "",
        total_reviews: totalReviews,
        pvp_matches: pvpStats?.total_matches || 0,
        pvp_rating: pvpStats?.total_score || 0,
    };

    return {
        success: true,
        data,
    };
}

/**
 * Cập nhật trạng thái người dùng
 */
export async function updateUserStatus(params: {
    adminId: string;
    userId: string;
    status: string;
    reason?: string | undefined;
}) {
    const { adminId, userId, status, reason } = params;

    if (adminId === userId) {
        throw new Error("CANNOT_MODIFY_SELF");
    }

    const user = await adminRepository.findUserById(userId);
    if (!user) {
        throw new Error("USER_NOT_FOUND");
    }

    const oldStatus = user.status;

    await db.prisma.$transaction(async (tx) => {
        // Cập nhật trạng thái
        await adminRepository.updateUserStatus(tx, userId, status);

        // Thu hồi session nếu suspended hoặc banned
        if (status === "suspended" || status === "banned") {
            await adminRepository.revokeAllSessions(tx, userId);
        }

        // Ghi log kiểm toán
        await adminRepository.createAuditLog(tx, {
            adminId,
            action: "user.status_changed",
            entityId: userId,
            beforeState: { status: oldStatus },
            afterState: { status, reason: reason ?? null },
        });
    });

    return {
        success: true,
        data: {
            id: userId,
            status,
        },
        message: "User status updated.",
    };
}

/**
 * Cập nhật vai trò người dùng (Promote/Demote)
 */
export async function updateUserRole(params: {
    adminId: string;
    userId: string;
    role: string;
}) {
    const { adminId, userId, role } = params;

    if (adminId === userId) {
        throw new Error("CANNOT_MODIFY_SELF");
    }

    const user = await adminRepository.findUserById(userId);
    if (!user) {
        throw new Error("USER_NOT_FOUND");
    }

    const oldRole = user.role;

    await db.prisma.$transaction(async (tx) => {
        // Cập nhật vai trò
        await adminRepository.updateUserRole(tx, userId, role);

        // Ghi log kiểm toán
        await adminRepository.createAuditLog(tx, {
            adminId,
            action: "user.role_changed",
            entityId: userId,
            beforeState: { role: oldRole },
            afterState: { role },
        });
    });

    return {
        success: true,
        data: {
            id: userId,
            role,
        },
        message: "User role updated.",
    };
}

/**
 * Lấy danh sách log kiểm toán có lọc và phân trang
 */
export async function listAuditLogs(query: ListAuditLogsQuery) {
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (query.start_date) {
        startDate = new Date(`${query.start_date}T00:00:00.000Z`);
    }
    if (query.end_date) {
        endDate = new Date(`${query.end_date}T23:59:59.999Z`);
    }

    const repoParams = {
        adminId: query.admin_id,
        action: query.action,
        startDate,
        endDate,
        page: query.page,
        limit: query.limit,
    };

    const logs = await adminRepository.findAuditLogs(repoParams);
    const total = await adminRepository.countAuditLogs(repoParams);

    const data: AuditLogDTO[] = logs.map(log => ({
        id: log.id,
        admin_id: log.admin_id,
        admin_name: log.users?.display_name || "Unknown Admin",
        action: log.action,
        entity_id: log.entity_id,
        before_state: log.before_state,
        after_state: log.after_state,
        created_at: log.created_at.toISOString(),
    }));

    const totalPages = Math.ceil(total / query.limit);

    return {
        success: true,
        data,
        meta: {
            page: query.page,
            limit: query.limit,
            total,
            total_pages: totalPages || 1,
        },
    };
}
