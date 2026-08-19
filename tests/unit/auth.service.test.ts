import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { register, verifyEmail, login } from "../../src/modules/auth/auth.service.js";
import bcrypt from "bcrypt";
import { authRepository } from "../../src/modules/auth/auth.repository.js";
import { db } from "../../src/config/prisma.js";

const originalPrisma = db.prisma;

test("Auth Service - Register Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
        // Mock Prisma Transaction toàn cục cho Unit Test
        db.prisma = {
            $transaction: async (callback: any) => {
                return callback({});
            }
        } as any;
    });

    afterEach(() => {
        db.prisma = originalPrisma;
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

        mock.method(authRepository, "findActiveUserByEmail", async () => null);
        mock.method(authRepository, "createUser", async () => mockUser);
        mock.method(authRepository, "createEmailVerificationToken", async () => ({ id: "token-uuid" }));

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

test("Auth Service - Verify Email Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
        // Mock Prisma Transaction toàn cục cho Unit Test
        db.prisma = {
            $transaction: async (callback: any) => {
                return callback({});
            }
        } as any;
    });

    afterEach(() => {
        db.prisma = originalPrisma;
    });

    await t.test("should verify email successfully", async () => {
        const mockToken = { 
            id: "token-id", 
            user_id: "user-id", 
            token_hash: "hash", 
            expires_at: new Date(Date.now() + 10000), 
            consumed_at: null 
        };
        const mockUser = { 
            id: "user-id", 
            email: "test@ex.com", 
            status: "active", 
            email_verified_at: new Date() 
        };

        mock.method(authRepository, "findTokenByHash", async () => mockToken);
        mock.method(authRepository, "updateUserStatus", async () => mockUser);
        mock.method(authRepository, "markTokenAsConsumed", async () => ({}));

        const result = await verifyEmail("raw-token");
        assert.strictEqual(result.email, "test@ex.com");
    });

    await t.test("should throw TOKEN_NOT_FOUND", async () => {
        mock.method(authRepository, "findTokenByHash", async () => null);
        await assert.rejects(verifyEmail("invalid"), /TOKEN_NOT_FOUND/);
    });
});

test("Auth Service - Login Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
        // Mock Prisma Transaction
        db.prisma = {
            $transaction: async (callback: any) => {
                return callback({});
            }
        } as any;
    });

    afterEach(() => {
        db.prisma = originalPrisma;
    });

    await t.test("should login successfully with valid credentials and active status", async () => {
        const mockUser = {
            id: "user-uuid-1",
            email: "login@example.com",
            password_hash: await bcrypt.hash("Pass123", 10),
            display_name: "Login User",
            status: "active",
            jlpt_target_level: "N3" as const,
        };

        mock.method(authRepository, "countRecentFailedAttempts", async () => 0);
        mock.method(authRepository, "findUserByEmail", async () => mockUser);
        mock.method(authRepository, "createLoginAttempt", async () => ({}));
        mock.method(authRepository, "createSession", async () => ({}));

        const result = await login(
            { email: "login@example.com", password: "Pass123" },
            { ipAddress: "127.0.0.1", userAgent: "test-agent" }
        );

        assert.ok(result.access_token);
        assert.ok(result.refresh_token);
        assert.strictEqual(result.user.email, mockUser.email);
        assert.strictEqual(result.user.display_name, mockUser.display_name);
        assert.strictEqual(result.user.role, "user");
        assert.strictEqual(result.user.is_premium, false);
    });

    await t.test("should throw ACCOUNT_TEMPORARILY_LOCKED if failed attempts >= 10", async () => {
        mock.method(authRepository, "countRecentFailedAttempts", async () => 10);
        await assert.rejects(
            login(
                { email: "login@example.com", password: "any" },
                { ipAddress: "127.0.0.1" }
            ),
            /ACCOUNT_TEMPORARILY_LOCKED/
        );
    });

    await t.test("should throw INVALID_CREDENTIALS when user does not exist", async () => {
        mock.method(authRepository, "countRecentFailedAttempts", async () => 0);
        mock.method(authRepository, "findUserByEmail", async () => null);
        mock.method(authRepository, "createLoginAttempt", async () => ({}));

        await assert.rejects(
            login(
                { email: "nonexistent@ex.com", password: "any" },
                { ipAddress: "127.0.0.1" }
            ),
            /INVALID_CREDENTIALS/
        );
    });

    await t.test("should throw INVALID_CREDENTIALS when password does not match", async () => {
        const mockUser = {
            id: "user-uuid-1",
            email: "login@example.com",
            password_hash: await bcrypt.hash("Pass123", 10),
            display_name: "Login User",
            status: "active",
        };

        mock.method(authRepository, "countRecentFailedAttempts", async () => 0);
        mock.method(authRepository, "findUserByEmail", async () => mockUser);
        mock.method(authRepository, "createLoginAttempt", async () => ({}));

        await assert.rejects(
            login(
                { email: "login@example.com", password: "WrongPassword" },
                { ipAddress: "127.0.0.1" }
            ),
            /INVALID_CREDENTIALS/
        );
    });

    await t.test("should throw EMAIL_NOT_VERIFIED when pending_verification", async () => {
        const mockUser = {
            id: "user-uuid-1",
            email: "login@example.com",
            password_hash: await bcrypt.hash("Pass123", 10),
            display_name: "Login User",
            status: "pending_verification",
        };

        mock.method(authRepository, "countRecentFailedAttempts", async () => 0);
        mock.method(authRepository, "findUserByEmail", async () => mockUser);

        await assert.rejects(
            login(
                { email: "login@example.com", password: "Pass123" },
                { ipAddress: "127.0.0.1" }
            ),
            /EMAIL_NOT_VERIFIED/
        );
    });

    await t.test("should throw ACCOUNT_SUSPENDED when suspended", async () => {
        const mockUser = {
            id: "user-uuid-1",
            email: "login@example.com",
            password_hash: await bcrypt.hash("Pass123", 10),
            display_name: "Login User",
            status: "suspended",
        };

        mock.method(authRepository, "countRecentFailedAttempts", async () => 0);
        mock.method(authRepository, "findUserByEmail", async () => mockUser);

        await assert.rejects(
            login(
                { email: "login@example.com", password: "Pass123" },
                { ipAddress: "127.0.0.1" }
            ),
            /ACCOUNT_SUSPENDED/
        );
    });

    await t.test("should throw ACCOUNT_BANNED when banned", async () => {
        const mockUser = {
            id: "user-uuid-1",
            email: "login@example.com",
            password_hash: await bcrypt.hash("Pass123", 10),
            display_name: "Login User",
            status: "banned",
        };

        mock.method(authRepository, "countRecentFailedAttempts", async () => 0);
        mock.method(authRepository, "findUserByEmail", async () => mockUser);

        await assert.rejects(
            login(
                { email: "login@example.com", password: "Pass123" },
                { ipAddress: "127.0.0.1" }
            ),
            /ACCOUNT_BANNED/
        );
    });
});

