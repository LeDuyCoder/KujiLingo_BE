import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { db } from "../../config/prisma.js";
import { authRepository } from "./auth.repository.js";

import { generateVerificationToken } from "../../common/utils/token.js";
import type { RegisterInput } from "./auth.schema.js";
import type { UserResponse } from "./auth.types.js";
import { mailService } from "../../common/services/mail/mail.service.js";
import { buildVerificationEmail } from "./templates/verification-email.template.js";
import { log } from "../../common/utils/log.js";

/**
 * Register new user
 * @param data RegisterInput
 * @returns {user: UserResponse, verificationToken: string}
 */
export async function register(data: RegisterInput): Promise<{
    user: UserResponse;
    verificationToken: string;
}> {
    const email = data.email.trim().toLowerCase();
    const existingUser =
        await authRepository.findActiveUserByEmail(email);

    if (existingUser) {
        throw new Error("DUPLICATE_EMAIL");
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const { token, tokenHash } =
        generateVerificationToken();
    const expiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000
    );

    const user = await db.prisma.$transaction(async (tx) => {
        const createdUser =
            await authRepository.createUser(tx, {
                email,
                passwordHash,
                displayName: data.display_name,
                acceptedTerms: data.accepted_terms,
                jlptTargetLevel: data.jlpt_target_level,
            });

        await authRepository.createEmailVerificationToken(tx, {
            userId: createdUser.id,
            tokenHash,
            expiresAt,
        });

        return createdUser;
    });

    // Gửi email xác thực SAU KHI transaction COMMIT thành công
    try {
        const { html, text } = buildVerificationEmail({
            displayName: user.display_name!,
            token,
        });
        await mailService.sendMail({
            to: user.email!,
            subject: "Xác thực tài khoản KujiLingo của bạn",
            html,
            text,
        });
    } catch (mailError) {
        // Log lỗi gửi mail nhưng KHÔNG crash registration
        // User vẫn có thể yêu cầu gửi lại email xác thực
        log.error("[Auth] Failed to send verification email:", mailError);
    }

    return {
        user: {
            id: user.id,
            email: user.email!,
            display_name: user.display_name!,
            jlpt_target_level: user.jlpt_target_level,
            email_verified: false,
            created_at: user.created_at!,
        },

        verificationToken: token,
    };
}

export async function verifyEmail(token: string): Promise<{
    email: string;
    status: string;
    email_verified_at: Date;
}> {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    return await db.prisma.$transaction(async (tx) => {
        const tokenRecord = await authRepository.findTokenByHash(tx, tokenHash);

        if (!tokenRecord) {
            throw new Error("TOKEN_NOT_FOUND");
        }

        if (tokenRecord.consumed_at) {
            // Rule 6: Nếu trạng thái user đã là active, trả về thành công để đảm bảo tính idempotent
            const user = await tx.users.findUnique({
                where: { id: tokenRecord.user_id }
            });
            if (user && user.status === "active") {
                return {
                    email: user.email!,
                    status: user.status,
                    email_verified_at: user.email_verified_at!,
                };
            }
            throw new Error("TOKEN_ALREADY_USED");
        }

        if (new Date(tokenRecord.expires_at) < new Date()) {
            throw new Error("TOKEN_EXPIRED");
        }

        const now = new Date();
        const user = await authRepository.updateUserStatus(tx, tokenRecord.user_id, now);
        await authRepository.markTokenAsConsumed(tx, tokenRecord.id, now);

        return {
            email: user.email!,
            status: user.status!,
            email_verified_at: user.email_verified_at!,
        };
    });
}

import type { LoginInput } from "./auth.schema.js";
import type { LoginResponse } from "./auth.types.js";
import { signToken } from "../../common/utils/jwt.js";
import { env } from "../../config/env.js";

/**
 * Đăng nhập người dùng bằng email và mật khẩu
 * @param data LoginInput dữ liệu đầu vào
 * @param reqInfo Thông tin thiết bị/kết nối của client
 */
export async function login(
    data: LoginInput,
    reqInfo: {
        ipAddress: string;
        userAgent?: string | undefined;
        deviceId?: string | undefined;
    }
): Promise<LoginResponse["data"]> {
    const email = data.email.trim().toLowerCase();

    // 1. Kiểm tra chính sách Lockout (Brute-Force Protection)
    // Nếu có >= 10 lượt đăng nhập thất bại trong 15 phút, khoá tài khoản ngay lập tức.
    const failedAttempts = await authRepository.countRecentFailedAttempts(email, 15);
    if (failedAttempts >= 10) {
        throw new Error("ACCOUNT_TEMPORARILY_LOCKED");
    }

    // 2. Tìm kiếm user trong DB (chấp nhận cả các trạng thái)
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
        // Ghi lại lượt thất bại ngoài transaction
        await authRepository.createLoginAttempt({
            email,
            ipAddress: reqInfo.ipAddress,
            userAgent: reqInfo.userAgent,
            succeeded: false,
        });
        throw new Error("INVALID_CREDENTIALS");
    }

    // 3. So khớp mật khẩu đã hash bcrypt
    const isPasswordValid = await bcrypt.compare(data.password, user.password_hash || "");
    if (!isPasswordValid) {
        await authRepository.createLoginAttempt({
            email,
            ipAddress: reqInfo.ipAddress,
            userAgent: reqInfo.userAgent,
            succeeded: false,
        });
        throw new Error("INVALID_CREDENTIALS");
    }

    // 4. Kiểm tra trạng thái tài khoản (Status Verification)
    if (user.status === "pending_verification" && !env.ALLOW_LOGIN_BEFORE_VERIFICATION) {
        throw new Error("EMAIL_NOT_VERIFIED");
    }
    if (user.status === "suspended") {
        throw new Error("ACCOUNT_SUSPENDED");
    }
    if (user.status === "banned") {
        throw new Error("ACCOUNT_BANNED");
    }

    // 5. Sinh cặp Token
    // Access Token chứa claims: sub (userId), role, is_premium
    const role = "user"; // Mặc định role là user
    const isPremium = false; // Mặc định chưa nâng cấp premium

    const accessToken = signToken({
        sub: user.id,
        role,
        is_premium: isPremium,
    });

    // Refresh Token là một chuỗi ngẫu nhiên dài 32 ký tự
    const rawRefreshToken = crypto.randomBytes(16).toString("hex");
    const refreshTokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 ngày

    // 6. Ghi nhận thành công vào login_attempts (best-effort ngoài transaction)
    await authRepository.createLoginAttempt({
        email,
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
        succeeded: true,
    });

    // 7. Lưu session (refresh token) và cập nhật last_login_at (trong transaction)
    await db.prisma.$transaction(async (tx) => {
        await authRepository.createSession(tx, {
            userId: user.id,
            tokenHash: refreshTokenHash,
            deviceId: reqInfo.deviceId,
            deviceName: data.device_name,
            ipAddress: reqInfo.ipAddress,
            userAgent: reqInfo.userAgent,
            expiresAt,
        });
    });

    return {
        access_token: accessToken,
        refresh_token: rawRefreshToken,
        token_type: "Bearer",
        expires_in: 900, // 15 phút = 900 giây
        user: {
            id: user.id,
            email: user.email!,
            display_name: user.display_name!,
            role: role,
            is_premium: isPremium,
            jlpt_target_level: user.jlpt_target_level,
        },
    };
}

/**
 * Gửi lại email kích hoạt tài khoản
 * @param email Email của user cần gửi lại
 */
export async function resendVerificationEmail(email: string): Promise<{ success: boolean; verificationToken: string }> {
    const trimmedEmail = email.trim().toLowerCase();
    const user = await authRepository.findUserByEmail(trimmedEmail);

    if (!user) {
        throw new Error("USER_NOT_FOUND");
    }

    if (user.status === "active" || user.email_verified) {
        throw new Error("EMAIL_ALREADY_VERIFIED");
    }

    const { token, tokenHash } = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 giờ

    await db.prisma.$transaction(async (tx) => {
        await authRepository.createEmailVerificationToken(tx, {
            userId: user.id,
            tokenHash,
            expiresAt,
        });
    });

    // Gửi email xác thực
    const { html, text } = buildVerificationEmail({
        displayName: user.display_name!,
        token,
    });

    await mailService.sendMail({
        to: user.email!,
        subject: "Xác thực tài khoản KujiLingo của bạn",
        html,
        text,
    });

    return {
        success: true,
        verificationToken: token,
    };
}
