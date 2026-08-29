import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { db } from "../../config/prisma.js";
import { authRepository } from "./auth.repository.js";

import { generateVerificationToken } from "../../common/utils/token.js";
import type { RegisterInput, LoginInput, LogoutInput, ForgotPasswordInput, ResetPasswordInput, RefreshTokenInput } from "./auth.schema.js";
import type { UserResponse, LoginResponse, CurrentUserResponse } from "./auth.types.js";
import { mailService } from "../../common/services/mail/mail.service.js";
import { buildVerificationEmail } from "./templates/verification-email.template.js";
import { buildForgotPasswordEmail } from "./templates/forgot-password.template.js";
import { buildPasswordChangedEmail } from "./templates/password-changed.template.js";
import { log } from "../../common/utils/log.js";
import { signToken } from "../../common/utils/jwt.js";
import { env } from "../../config/env.js";
import { rateLimiter } from "../../common/utils/rate-limiter.js";

/**
 * Register new user
 */
export async function register(data: RegisterInput): Promise<{
    user: UserResponse;
    verificationToken: string;
}> {
    const email = data.email.trim().toLowerCase();
    const existingUser = await authRepository.findActiveUserByEmail(email);

    if (existingUser) {
        throw new Error("DUPLICATE_EMAIL");
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const { token, tokenHash } = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await db.prisma.$transaction(async (tx) => {
        const createdUser = await authRepository.createUser(tx, {
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

/**
 * Đăng nhập
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

    const failedAttempts = await authRepository.countRecentFailedAttempts(email, 15);
    if (failedAttempts >= 10) {
        throw new Error("ACCOUNT_TEMPORARILY_LOCKED");
    }

    const user = await authRepository.findUserByEmail(email);
    if (!user) {
        await authRepository.createLoginAttempt({
            email,
            ipAddress: reqInfo.ipAddress,
            userAgent: reqInfo.userAgent,
            succeeded: false,
        });
        throw new Error("INVALID_CREDENTIALS");
    }

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

    if (user.status === "pending_verification" && !env.ALLOW_LOGIN_BEFORE_VERIFICATION) {
        throw new Error("EMAIL_NOT_VERIFIED");
    }
    if (user.status === "suspended") {
        throw new Error("ACCOUNT_SUSPENDED");
    }
    if (user.status === "banned") {
        throw new Error("ACCOUNT_BANNED");
    }

    const role = user.role || "user";
    const isPremium = false;

    const accessToken = signToken({
        sub: user.id,
        role,
        is_premium: isPremium,
    });

    const rawRefreshToken = crypto.randomBytes(16).toString("hex");
    const refreshTokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await authRepository.createLoginAttempt({
        email,
        ipAddress: reqInfo.ipAddress,
        userAgent: reqInfo.userAgent,
        succeeded: true,
    });

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
        expires_in: 900,
        user: {
            id: user.id,
            email: user.email!,
            display_name: user.display_name!,
            role,
            is_premium: isPremium,
            jlpt_target_level: user.jlpt_target_level,
        },
    };
}

/**
 * Gửi lại email kích hoạt tài khoản
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
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.prisma.$transaction(async (tx) => {
        await authRepository.createEmailVerificationToken(tx, {
            userId: user.id,
            tokenHash,
            expiresAt,
        });
    });

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

/**
 * Đăng xuất
 */
export async function logout(userId: string, data: LogoutInput): Promise<{ success: boolean }> {
    if (data.all_devices) {
        await authRepository.revokeAllForUser(db.prisma, userId);
    } else if (data.refresh_token) {
        const hash = crypto.createHash("sha256").update(data.refresh_token).digest("hex");
        const tokenRecord = await authRepository.findRefreshTokenByHash(db.prisma, hash);

        if (tokenRecord) {
            if (tokenRecord.user_id !== userId) {
                throw new Error("TOKEN_OWNERSHIP_MISMATCH");
            }
            await authRepository.revokeToken(tokenRecord.id);
        }
    }
    return { success: true };
}

/**
 * Quên mật khẩu
 */
export async function forgotPassword(
    data: ForgotPasswordInput,
    ipAddress: string
): Promise<{ success: boolean; message: string }> {
    const email = data.email.trim().toLowerCase();
    
    // 1. Kiểm tra rate limit
    // Mỗi email: tối đa 3 lần/giờ. Mỗi IP: tối đa 10 lần/giờ.
    const emailKey = `rate_forgot_email:${email}`;
    const ipKey = `rate_forgot_ip:${ipAddress}`;
    const oneHourMs = 60 * 60 * 1000;
    
    const emailAllowed = rateLimiter.checkLimit(emailKey, 3, oneHourMs);
    const ipAllowed = rateLimiter.checkLimit(ipKey, 10, oneHourMs);
    
    const genericSuccessResponse = {
        success: true,
        message: "If an account with that email exists, a password reset link has been sent.",
    };
    
    if (!emailAllowed || !ipAllowed) {
        // Silently cap: Trả về thành công giả nhưng không thực hiện gửi email hay tạo token
        return genericSuccessResponse;
    }
    
    // 2. Tìm kiếm người dùng theo email (chỉ người dùng active)
    const user = await authRepository.findUserByEmail(email);
    if (!user || user.status !== "active") {
        // Trả về thành công giả để tránh enumeration
        return genericSuccessResponse;
    }
    
    // 3. Tạo token đặt lại mật khẩu và thực hiện trong transaction
    const rawResetToken = crypto.randomBytes(16).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawResetToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 giờ
    
    await db.prisma.$transaction(async (tx) => {
        // Vô hiệu hóa tất cả các token trước đó của user này chưa được sử dụng
        await authRepository.invalidatePasswordResetTokensForUser(tx, user.id);
        // Lưu token mới
        await authRepository.createPasswordResetToken(tx, {
            userId: user.id,
            tokenHash,
            expiresAt,
        });
    });
    
    // 4. Gửi email xác thực bất đồng bộ
    try {
        const { html, text } = buildForgotPasswordEmail({
            displayName: user.display_name!,
            token: rawResetToken,
        });
        await mailService.sendMail({
            to: user.email!,
            subject: "Đặt lại mật khẩu tài khoản KujiLingo của bạn",
            html,
            text,
        });
    } catch (mailError) {
        log.error("[Auth] Failed to send password reset email:", mailError);
    }
    
    return genericSuccessResponse;
}

/**
 * Đặt lại mật khẩu bằng token
 */
export async function resetPassword(data: ResetPasswordInput): Promise<{ success: boolean; message: string }> {
    const tokenHash = crypto.createHash("sha256").update(data.token).digest("hex");

    return await db.prisma.$transaction(async (tx) => {
        // 1. Tìm kiếm reset token FOR UPDATE
        const tokenRecord = await authRepository.findPasswordResetTokenByHash(tx, tokenHash);
        if (!tokenRecord) {
            throw new Error("TOKEN_NOT_FOUND");
        }

        // 2. Kiểm tra xem token đã được sử dụng chưa
        if (tokenRecord.consumed_at) {
            throw new Error("TOKEN_ALREADY_USED");
        }

        // 3. Kiểm tra xem token đã hết hạn chưa
        if (new Date(tokenRecord.expires_at) < new Date()) {
            throw new Error("TOKEN_EXPIRED");
        }

        // 4. Tìm kiếm người dùng tương ứng
        const user = await tx.users.findUnique({
            where: { id: tokenRecord.user_id },
        });

        if (!user || user.deleted_at) {
            throw new Error("TOKEN_NOT_FOUND");
        }

        // 5. Kiểm tra mật khẩu mới có giống mật khẩu cũ không
        const isIdentical = await bcrypt.compare(data.new_password, user.password_hash || "");
        if (isIdentical) {
            throw new Error("PASSWORD_UNCHANGED");
        }

        // 6. Thực hiện đổi mật khẩu, tiêu thụ token, và hủy toàn bộ refresh tokens
        const passwordHash = await bcrypt.hash(data.new_password, 12);
        
        await authRepository.updatePasswordHash(tx, user.id, passwordHash);
        await authRepository.markPasswordResetTokenAsConsumed(tx, tokenRecord.id, new Date());
        await authRepository.revokeAllForUser(tx, user.id);

        return user;
    }).then(async (user) => {
        // Gửi email xác nhận đặt lại mật khẩu thành công
        try {
            const { html, text } = buildPasswordChangedEmail({
                displayName: user.display_name!,
            });
            await mailService.sendMail({
                to: user.email!,
                subject: "Mật khẩu tài khoản KujiLingo của bạn đã được thay đổi",
                html,
                text,
            });
        } catch (mailError) {
            log.error("[Auth] Failed to send password changed confirmation email:", mailError);
        }

        return {
            success: true,
            message: "Password has been reset successfully. Please log in with your new password.",
        };
    });
}

/**
 * Lấy thông tin người dùng hiện tại theo ID từ JWT sub
 */
export async function getCurrentUser(userId: string): Promise<CurrentUserResponse> {
    const user = await authRepository.findUserById(userId);

    if (!user) {
        throw new Error("UNAUTHORIZED");
    }

    if (user.status === "suspended") {
        throw new Error("ACCOUNT_SUSPENDED");
    }
    if (user.status === "banned") {
        throw new Error("ACCOUNT_BANNED");
    }

    return {
        id: user.id,
        email: user.email!,
        display_name: user.display_name || "",
        avatar_url: user.avatar ?? null,
        role: user.role || "user",
        is_premium: false,
        premium_expires_at: null,
        jlpt_target_level: user.jlpt_target_level,
        status: user.status || "pending_verification",
        email_verified_at: user.email_verified_at ? user.email_verified_at.toISOString() : null,
        last_login_at: user.last_login_at ? user.last_login_at.toISOString() : null,
        timezone: "Asia/Ho_Chi_Minh",
        locale: "vi-VN",
        created_at: user.created_at ? user.created_at.toISOString() : new Date().toISOString(),
    };
}

/**
 * Làm mới access token bằng refresh token (Refresh Token Rotation - RTR)
 */
export async function refreshToken(
    data: RefreshTokenInput,
    reqInfo: { ipAddress: string; userAgent?: string }
): Promise<{
    access_token: string;
    refresh_token: string;
    token_type: "Bearer";
    expires_in: number;
}> {
    const hash = crypto.createHash("sha256").update(data.refresh_token).digest("hex");

    return await db.prisma.$transaction(async (tx) => {
        // 1. Tìm refresh token record
        const tokenRecord = await authRepository.findRefreshTokenByHash(tx, hash);
        if (!tokenRecord) {
            throw new Error("UNAUTHORIZED");
        }

        // 2. Kiểm tra nếu đã bị thu hồi (revoked) hoặc hết hạn (expired)
        if (tokenRecord.is_revoked || new Date(tokenRecord.expires_at) < new Date()) {
            if (tokenRecord.is_revoked) {
                await authRepository.revokeAllForUser(tx, tokenRecord.user_id);
            }
            throw new Error("UNAUTHORIZED");
        }

        // 3. Tìm người dùng tương ứng
        const user = await tx.users.findUnique({
            where: { id: tokenRecord.user_id },
        });

        if (!user || user.deleted_at) {
            throw new Error("UNAUTHORIZED");
        }

        if (user.status === "suspended") {
            throw new Error("ACCOUNT_SUSPENDED");
        }
        if (user.status === "banned") {
            throw new Error("ACCOUNT_BANNED");
        }

        // 4. Thu hồi (revoke) refresh token cũ
        await tx.refresh_tokens.update({
            where: { id: tokenRecord.id },
            data: { is_revoked: true },
        });

        // 5. Tạo refresh token mới (Rotation)
        const rawNewRefreshToken = crypto.randomBytes(16).toString("hex");
        const newRefreshTokenHash = crypto.createHash("sha256").update(rawNewRefreshToken).digest("hex");
        const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 ngày

        await tx.refresh_tokens.create({
            data: {
                id: crypto.randomUUID(),
                user_id: user.id,
                token_hash: newRefreshTokenHash,
                device_id: tokenRecord.device_id,
                device_name: tokenRecord.device_name,
                ip_address: reqInfo.ipAddress,
                user_agent: reqInfo.userAgent ?? null,
                expires_at: newExpiresAt,
            },
        });

        // 6. Tạo access token mới
        const role = user.role || "user";
        const isPremium = false;

        const accessToken = signToken({
            sub: user.id,
            role,
            is_premium: isPremium,
        });

        return {
            access_token: accessToken,
            refresh_token: rawNewRefreshToken,
            token_type: "Bearer" as const,
            expires_in: 900,
        };
    });
}
