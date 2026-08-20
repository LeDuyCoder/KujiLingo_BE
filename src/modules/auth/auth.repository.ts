import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import crypto from "node:crypto";

type TransactionClient = Prisma.TransactionClient;

/**
 * Tìm người dùng đã kích hoạt theo email
 * @param email Email cần tìm
 * @returns Người dùng đã kích hoạt hoặc null
 */
export async function findActiveUserByEmail(email: string) {
    return prisma.users.findFirst({
        where: {
            email: {
                equals: email,
                mode: "insensitive",
            },
            deleted_at: null,
        },
    });
}

/**
 * Tạo người dùng mới
 * @param tx Transaction client
 * @param data Dữ liệu người dùng
 * @returns Người dùng mới
 */
export async function createUser(
    tx: TransactionClient,
    data: {
        email: string;
        passwordHash: string;
        displayName: string;
        acceptedTerms: boolean;
        jlptTargetLevel?: any;
    },
) {
    return tx.users.create({
        data: {
            id: crypto.randomUUID(),
            email: data.email,
            password_hash: data.passwordHash,
            display_name: data.displayName,
            accepted_terms: data.acceptedTerms,
            jlpt_target_level: data.jlptTargetLevel,
        },
    });
}

/**
 * Tạo token xác thực email
 * @param tx Transaction client
 * @param data Dữ liệu token
 * @returns Token xác thực email
 */
export async function createEmailVerificationToken(
    tx: TransactionClient,
    data: {
        userId: string;
        tokenHash: string;
        expiresAt: Date;
    },
) {
    return tx.email_verification_tokens.create({
        data: {
            user_id: data.userId,
            token_hash: data.tokenHash,
            expires_at: data.expiresAt,
        },
    });
}

/**
 * Tìm token xác thực email theo hash
 * @param tx Transaction client
 * @param hash Hash token
 * @returns Token xác thực email hoặc null
 */
export async function findTokenByHash(tx: TransactionClient, hash: string) {
    const tokens = await tx.$queryRaw<any[]>`
        SELECT * FROM "email_verification_tokens" 
        WHERE "token_hash" = ${hash} 
        LIMIT 1
        FOR UPDATE
    `;
    return tokens[0] || null;
}

/**
 * Đánh dấu token đã được sử dụng
 * @param tx Transaction client
 * @param tokenId ID của token
 * @param now Thời gian hiện tại
 * @returns Token đã được đánh dấu
 */
export async function markTokenAsConsumed(tx: TransactionClient, tokenId: string, now: Date) {
    return tx.email_verification_tokens.update({
        where: { id: tokenId },
        data: { consumed_at: now },
    });
}

/**
 * Cập nhật trạng thái người dùng
 * @param tx Transaction client
 * @param userId ID của người dùng
 * @param now Thời gian hiện tại
 * @returns Người dùng đã được cập nhật
 */
export async function updateUserStatus(tx: TransactionClient, userId: string, now: Date) {
    return tx.users.update({
        where: { id: userId },
        data: {
            status: "active",
            email_verified: true,
            email_verified_at: now,
            updated_at: now,
        },
    });
}

/**
 * Tìm người dùng theo email (kể cả chưa kích hoạt)
 * @param email Email cần tìm
 * @returns Người dùng hoặc null
 */
export async function findUserByEmail(email: string) {
    return prisma.users.findFirst({
        where: {
            email: {
                equals: email,
                mode: "insensitive",
            },
            deleted_at: null,
        },
    });
}

/**
 * Đếm số lần đăng nhập thất bại của một email trong khoảng thời gian xác định (phục vụ chặn brute-force)
 * @param email Email cần kiểm tra
 * @param windowMinutes Khoảng thời gian lăn (rolling window) tính bằng phút
 * @returns Số lần đăng nhập thất bại
 */
export async function countRecentFailedAttempts(email: string, windowMinutes: number): Promise<number> {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    return prisma.login_attempts.count({
        where: {
            email: {
                equals: email,
                mode: "insensitive",
            },
            succeeded: false,
            created_at: {
                gte: cutoff,
            },
        },
    });
}

/**
 * Ghi nhận một lượt đăng nhập (succeeded = true/false)
 * Thực hiện best-effort ngoài transaction
 */
export async function createLoginAttempt(data: {
    email: string;
    ipAddress: string;
    userAgent?: string | undefined;
    succeeded: boolean;
}) {
    return prisma.login_attempts.create({
        data: {
            id: crypto.randomUUID(),
            email: data.email,
            ip_address: data.ipAddress,
            succeeded: data.succeeded,
            user_agent: data.userAgent ?? null,
        },
    });
}

/**
 * Lưu refresh token và cập nhật thời gian đăng nhập cuối cùng của người dùng
 * Chạy trong transaction để đảm bảo tính nguyên tử
 */
export async function createSession(
    tx: TransactionClient,
    data: {
        userId: string;
        tokenHash: string;
        deviceId?: string | undefined;
        deviceName?: string | undefined;
        ipAddress: string;
        userAgent?: string | undefined;
        expiresAt: Date;
    }
) {
    // 1. Lưu hash của refresh token
    await tx.refresh_tokens.create({
        data: {
            id: crypto.randomUUID(),
            user_id: data.userId,
            token_hash: data.tokenHash,
            device_id: data.deviceId ?? null,
            device_name: data.deviceName ?? null,
            ip_address: data.ipAddress,
            user_agent: data.userAgent ?? null,
            expires_at: data.expiresAt,
        },
    });

    // 2. Cập nhật last_login_at của users
    return tx.users.update({
        where: { id: data.userId },
        data: {
            last_login_at: new Date(),
        },
    });
}

export async function findRefreshTokenByHash(tx: TransactionClient, hash: string) {
    return tx.refresh_tokens.findUnique({
        where: { token_hash: hash },
    });
}

export async function revokeToken(tokenId: string) {
    return prisma.refresh_tokens.update({
        where: { id: tokenId },
        data: { is_revoked: true },
    });
}

export async function revokeAllForUser(tx: TransactionClient, userId: string) {
    return tx.refresh_tokens.updateMany({
        where: { user_id: userId, is_revoked: false },
        data: { is_revoked: true },
    });
}

export async function updatePasswordHash(tx: TransactionClient, userId: string, newHash: string) {
    return tx.users.update({
        where: { id: userId },
        data: {
            password_hash: newHash,
            updated_at: new Date(),
        },
    });
}

export async function markPasswordResetTokenAsConsumed(tx: TransactionClient, tokenId: string, now: Date) {
    return tx.password_reset_tokens.update({
        where: { id: tokenId },
        data: { consumed_at: now },
    });
}

export async function invalidatePasswordResetTokensForUser(tx: TransactionClient, userId: string) {
    return tx.password_reset_tokens.updateMany({
        where: {
            user_id: userId,
            consumed_at: null,
        },
        data: {
            consumed_at: new Date(),
        },
    });
}

export async function createPasswordResetToken(
    tx: TransactionClient,
    data: {
        userId: string;
        tokenHash: string;
        expiresAt: Date;
    }
) {
    return tx.password_reset_tokens.create({
        data: {
            id: crypto.randomUUID(),
            user_id: data.userId,
            token_hash: data.tokenHash,
            expires_at: data.expiresAt,
        },
    });
}

export async function findPasswordResetTokenByHash(tx: TransactionClient, hash: string) {
    const tokens = await tx.$queryRaw<any[]>`
        SELECT * FROM "password_reset_tokens"
        WHERE "token_hash" = ${hash}
        LIMIT 1
        FOR UPDATE
    `;
    return tokens[0] || null;
}

/**
 * Repository các hàm liên quan đến xác thực
 */
export const authRepository = {
    findActiveUserByEmail,
    findUserByEmail,
    createUser,
    createEmailVerificationToken,
    findTokenByHash,
    markTokenAsConsumed,
    updateUserStatus,
    countRecentFailedAttempts,
    createLoginAttempt,
    createSession,
    findRefreshTokenByHash,
    revokeToken,
    revokeAllForUser,
    invalidatePasswordResetTokensForUser,
    createPasswordResetToken,
    findPasswordResetTokenByHash,
    updatePasswordHash,
    markPasswordResetTokenAsConsumed,
};