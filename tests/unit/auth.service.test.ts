import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { register, verifyEmail, login, logout, forgotPassword } from "../../src/modules/auth/auth.service.js";
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

test("Auth Service - Logout Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
    });

    await t.test("should revoke single token successfully", async () => {
        const mockToken = { id: "token-123", user_id: "user-456" };
        
        mock.method(authRepository, "findRefreshTokenByHash", async () => mockToken);
        const revokeTokenMock = mock.method(authRepository, "revokeToken", async () => ({}));

        const result = await logout("user-456", { 
            refresh_token: "valid-token",
            all_devices: false 
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(revokeTokenMock.mock.callCount(), 1);
    });

    await t.test("should throw TOKEN_OWNERSHIP_MISMATCH if token belongs to another user", async () => {
        const mockToken = { id: "token-123", user_id: "other-user" };
        
        mock.method(authRepository, "findRefreshTokenByHash", async () => mockToken);

        await assert.rejects(
            logout("my-user-id", { 
                refresh_token: "someone-elses-token",
                all_devices: false 
            }),
            /TOKEN_OWNERSHIP_MISMATCH/
        );
    });

    await t.test("should revoke all tokens for user successfully", async () => {
        const revokeAllMock = mock.method(authRepository, "revokeAllForUser", async () => ({}));

        const result = await logout("user-123", { 
            all_devices: true 
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(revokeAllMock.mock.callCount(), 1);
    });

    await t.test("should be idempotent if token not found", async () => {
        mock.method(authRepository, "findRefreshTokenByHash", async () => null);
        const revokeTokenMock = mock.method(authRepository, "revokeToken", async () => ({}));

        const result = await logout("user-123", { 
            refresh_token: "non-existent",
            all_devices: false 
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(revokeTokenMock.mock.callCount(), 0);
    });
});

test("Auth Service - Forgot Password Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
        db.prisma = {
            $transaction: async (callback: any) => {
                return callback({});
            }
        } as any;
    });

    afterEach(() => {
        db.prisma = originalPrisma;
    });

    await t.test("should return generic success message and create a reset token for existing active user", async () => {
        const mockUser = {
            id: "user-uuid-123",
            email: "active@example.com",
            display_name: "Active User",
            status: "active",
        };

        const findUserMock = mock.method(authRepository, "findUserByEmail", async () => mockUser);
        const invalidateMock = mock.method(authRepository, "invalidatePasswordResetTokensForUser", async () => ({}));
        const createTokenMock = mock.method(authRepository, "createPasswordResetToken", async () => ({}));

        const result = await forgotPassword({ email: "active@example.com" }, "127.0.0.1");

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, "If an account with that email exists, a password reset link has been sent.");
        assert.strictEqual(findUserMock.mock.callCount(), 1);
        assert.strictEqual(invalidateMock.mock.callCount(), 1);
        assert.strictEqual(createTokenMock.mock.callCount(), 1);
    });

    await t.test("should return generic success message but create no token for non-existent email", async () => {
        const findUserMock = mock.method(authRepository, "findUserByEmail", async () => null);
        const invalidateMock = mock.method(authRepository, "invalidatePasswordResetTokensForUser", async () => ({}));
        const createTokenMock = mock.method(authRepository, "createPasswordResetToken", async () => ({}));

        const result = await forgotPassword({ email: "nonexistent@example.com" }, "127.0.0.1");

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, "If an account with that email exists, a password reset link has been sent.");
        assert.strictEqual(findUserMock.mock.callCount(), 1);
        assert.strictEqual(invalidateMock.mock.callCount(), 0);
        assert.strictEqual(createTokenMock.mock.callCount(), 0);
    });

    await t.test("should return generic success message but create no token for suspended or banned email", async () => {
        const mockUser = {
            id: "user-uuid-123",
            email: "suspended@example.com",
            display_name: "Suspended User",
            status: "suspended",
        };

        const findUserMock = mock.method(authRepository, "findUserByEmail", async () => mockUser);
        const invalidateMock = mock.method(authRepository, "invalidatePasswordResetTokensForUser", async () => ({}));
        const createTokenMock = mock.method(authRepository, "createPasswordResetToken", async () => ({}));

        const result = await forgotPassword({ email: "suspended@example.com" }, "127.0.0.1");

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, "If an account with that email exists, a password reset link has been sent.");
        assert.strictEqual(findUserMock.mock.callCount(), 1);
        assert.strictEqual(invalidateMock.mock.callCount(), 0);
        assert.strictEqual(createTokenMock.mock.callCount(), 0);
    });

    await t.test("should return 200 but create no token beyond rate limit (max 3 per email per hour)", async () => {
        const mockUser = {
            id: "user-uuid-123",
            email: "ratelimit@example.com",
            display_name: "Rate User",
            status: "active",
        };

        mock.method(authRepository, "findUserByEmail", async () => mockUser);
        const invalidateMock = mock.method(authRepository, "invalidatePasswordResetTokensForUser", async () => ({}));
        const createTokenMock = mock.method(authRepository, "createPasswordResetToken", async () => ({}));
        
        // Call it 3 times (success)
        for (let i = 0; i < 3; i++) {
            const res = await forgotPassword({ email: "ratelimit@example.com" }, "127.0.0.1");
            assert.strictEqual(res.success, true);
        }
        assert.strictEqual(createTokenMock.mock.callCount(), 3);

        // 4th call should be silently capped
        const res4 = await forgotPassword({ email: "ratelimit@example.com" }, "127.0.0.1");
        assert.strictEqual(res4.success, true);
        assert.strictEqual(createTokenMock.mock.callCount(), 3); // still 3
    });
});

