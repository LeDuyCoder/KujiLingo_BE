import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { db } from "../../config/prisma.js";
import { authRepository } from "./auth.repository.js";

import { generateVerificationToken } from "../../common/utils/token.js";
import type { RegisterInput } from "./auth.schema.js";
import type { UserResponse } from "./auth.types.js";
import { mailService } from "../../common/services/mail/mail.service.js";
import { buildVerificationEmail } from "./templates/verification-email.template.js";

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
        console.error("[Auth] Failed to send verification email:", mailError);
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