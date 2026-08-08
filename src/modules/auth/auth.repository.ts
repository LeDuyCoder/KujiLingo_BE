import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import crypto from "node:crypto";

type TransactionClient = Prisma.TransactionClient;

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

export const authRepository = {
    findActiveUserByEmail,
    createUser,
    createEmailVerificationToken,
};