import { test, mock, beforeEach } from "node:test";
import assert from "node:assert";
import { register } from "../../src/modules/auth/auth.service.js";
import { authRepository } from "../../src/modules/auth/auth.repository.js";
import { db } from "../../src/config/prisma.js";

test("Auth Service - Register Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
    });

    await t.test("should register a new user successfully", async () => {
        const mockUser = {
            id: "user-uuid-123",
            email: "test@example.com",
            display_name: "Test User",
            jlpt_target_level: "N3" as const,
            email_verified: false,
            created_at: new Date(),
        };

        // Mock findActiveUserByEmail
        mock.method(authRepository, "findActiveUserByEmail", async () => null);

        // Gán mock cho db.prisma để bỏ qua transaction của Prisma thực tế
        const originalPrisma = db.prisma;
        db.prisma = {
            $transaction: async (callback: any) => {
                return callback({});
            }
        } as any;

        // Mock các hàm repository
        mock.method(authRepository, "createUser", async () => mockUser);
        mock.method(authRepository, "createEmailVerificationToken", async () => ({ id: "token-uuid" }));

        try {
            const result = await register({
                email: "test@example.com",
                password: "Password123",
                password_confirmation: "Password123",
                display_name: "Test User",
                accepted_terms: true,
                jlpt_target_level: "N3",
            });

            assert.ok(result.verificationToken);
            assert.strictEqual(result.user.id, mockUser.id);
            assert.strictEqual(result.user.email, mockUser.email);
            assert.strictEqual(result.user.display_name, mockUser.display_name);
            assert.strictEqual(result.user.jlpt_target_level, "N3");
        } finally {
            // Restore prisma gốc sau khi test xong
            db.prisma = originalPrisma;
        }
    });

    await t.test("should throw error if email is already active", async () => {
        const mockExistingUser = {
            id: "existing-user-uuid",
            email: "test@example.com",
            display_name: "Existing",
            jlpt_target_level: null,
            email_verified: true,
            created_at: new Date(),
        };

        mock.method(authRepository, "findActiveUserByEmail", async () => mockExistingUser);

        await assert.rejects(
            async () => {
                await register({
                    email: "test@example.com",
                    password: "Password123",
                    password_confirmation: "Password123",
                    display_name: "Test User",
                    accepted_terms: true,
                });
            },
            (err: any) => {
                assert.strictEqual(err.message, "DUPLICATE_EMAIL");
                return true;
            }
        );
    });
});
