import bcrypt from "bcrypt";
import { db } from "../../config/prisma.js";
import { authRepository } from "./auth.repository.js";

import { generateVerificationToken } from "../../common/utils/token.js";
import type { RegisterInput } from "./auth.schema.js";
import type { UserResponse } from "./auth.types.js";

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