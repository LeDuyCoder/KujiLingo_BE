import { test, beforeEach, after, mock } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import * as jwtUtils from "../../src/common/utils/jwt.js";
import jwt from "jsonwebtoken";

async function clearDatabase() {
    // Xóa theo thứ tự để tránh khóa ngoại (foreign key)
    await prisma.favorite_vocabularies.deleteMany({});
    await prisma.grammar_points.deleteMany({});
    await prisma.payment_transactions.deleteMany({});
    await prisma.wallet_histories.deleteMany({});
    await prisma.user_wallets.deleteMany({});
    await prisma.user_achievements.deleteMany({});
    await prisma.learning_progress.deleteMany({});
    await prisma.review_histories.deleteMany({});
    await prisma.user_vocabularies.deleteMany({});
    await prisma.user_shop_items.deleteMany({});
    await prisma.user_equipped_items.deleteMany({});
    await prisma.user_statistics_daily.deleteMany({});
    await prisma.login_attempts.deleteMany({});
    await prisma.refresh_tokens.deleteMany({});
    await prisma.password_reset_tokens.deleteMany({});
    await prisma.email_verification_tokens.deleteMany({});
    await prisma.users.deleteMany({});
}

test("Auth API - Database Integration Tests", async (t) => {
    // Dọn dẹp DB trước mỗi test để đảm bảo môi trường sạch
    beforeEach(async () => {
        await clearDatabase();
    });

    // Dọn dẹp DB sau khi chạy xong toàn bộ test suite
    after(async () => {
        await clearDatabase();
    });

    await t.test("POST /auth/register - success 201", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email: "duyga544@gmail.com",
                password: "Password123",
                password_confirmation: "Password123",
                display_name: "New User",
                accepted_terms: true,
                jlpt_target_level: "N5",
            },
        });

        const body = JSON.parse(response.body);

        assert.strictEqual(response.statusCode, 201);
        assert.strictEqual(body.code, "REGISTER_SUCCESS");
        assert.strictEqual(body.user.email, "duyga544@gmail.com");
        assert.ok(body.verificationToken);

        // Kiểm tra thực tế trong DB
        const userInDb = await prisma.users.findUnique({ where: { email: "duyga544@gmail.com" } });
        assert.ok(userInDb, "User phải được lưu trong DB");
    });

    await t.test("POST /auth/register - validation error 400", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email: "duybeo@gmail.com",
                password: "Password123",
                password_confirmation: "WrongPassword",
                display_name: "New User",
                accepted_terms: true,
            },
        });

        assert.strictEqual(response.statusCode, 400);
    });

    await t.test("POST /auth/register - duplicate email 409", async () => {
        // Tạo trước một user trong DB
        await prisma.users.create({
            data: {
                id: "550e8400-e29b-41d4-a716-446655440000",
                email: "existing@example.com",
                password_hash: "hashed_pass",
            }
        });

        const response = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email: "existing@example.com",
                password: "Password123",
                password_confirmation: "Password123",
                display_name: "New User",
                accepted_terms: true,
            },
        });

        assert.strictEqual(response.statusCode, 409);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.code, "REGISTER_DUPLICATE_EMAIL");
    });

    await t.test("POST /auth/verify-email - success 200", async () => {
        // 1. Đăng ký để lấy token thật
        const registerResponse = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email: "verifyuser@example.com",
                password: "Password123",
                password_confirmation: "Password123",
                display_name: "Verify Me",
                accepted_terms: true,
            },
        });
        const { verificationToken } = JSON.parse(registerResponse.body);

        // 2. Gọi api verify
        const response = await app.inject({
            method: "POST",
            url: "/auth/verify-email",
            payload: {
                token: verificationToken,
            },
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.email, "verifyuser@example.com");
        assert.strictEqual(body.data.status, "active");

        // 3. Kiểm tra DB
        const user = await prisma.users.findUnique({ where: { email: "verifyuser@example.com" } });
        assert.strictEqual(user?.status, "active");
        assert.strictEqual(user?.email_verified, true);
        assert.ok(user?.email_verified_at);
    });

    await t.test("POST /auth/verify-email - not found 404", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/auth/verify-email",
            payload: {
                token: "non-existent-token-uuid",
            },
        });

        assert.strictEqual(response.statusCode, 404);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "TOKEN_NOT_FOUND");
    });

    await t.test("POST /auth/verify-email - expired token 410", async () => {
        // 1. Tạo user thủ công
        const userId = "550e8400-e29b-41d4-a716-446655440022";
        await prisma.users.create({
            data: {
                id: userId,
                email: "expired@example.com",
                password_hash: "hashed",
                status: "pending_verification",
            },
        });

        // 2. Tạo token hết hạn thủ công
        const rawToken = "my-expired-token-value";
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        await prisma.email_verification_tokens.create({
            data: {
                user_id: userId,
                token_hash: tokenHash,
                expires_at: new Date(Date.now() - 1000), // đã hết hạn cách đây 1s
            },
        });

        // 3. Gọi api
        const response = await app.inject({
            method: "POST",
            url: "/auth/verify-email",
            payload: {
                token: rawToken,
            },
        });

        assert.strictEqual(response.statusCode, 410);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "TOKEN_EXPIRED");
    });

    await t.test("POST /auth/verify-email - already used 409", async () => {
        // 1. Tạo user thủ công
        const userId = "550e8400-e29b-41d4-a716-446655440033";
        await prisma.users.create({
            data: {
                id: userId,
                email: "alreadyused@example.com",
                password_hash: "hashed",
                status: "pending_verification", // vẫn chưa kích hoạt
            },
        });

        // 2. Tạo token đã sử dụng thủ công
        const rawToken = "my-used-token-value";
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        await prisma.email_verification_tokens.create({
            data: {
                user_id: userId,
                token_hash: tokenHash,
                expires_at: new Date(Date.now() + 100000),
                consumed_at: new Date(), // đã sử dụng
            },
        });

        // 3. Gọi api
        const response = await app.inject({
            method: "POST",
            url: "/auth/verify-email",
            payload: {
                token: rawToken,
            },
        });

        assert.strictEqual(response.statusCode, 409);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "TOKEN_ALREADY_USED");
    });

    await t.test("POST /auth/verify-email - idempotent success 200", async () => {
        // 1. Đăng ký tài khoản
        const registerResponse = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email: "idempotent@example.com",
                password: "Password123",
                password_confirmation: "Password123",
                display_name: "Idempotent User",
                accepted_terms: true,
            },
        });
        const { verificationToken } = JSON.parse(registerResponse.body);

        // 2. Kích hoạt lần 1 -> 200 OK
        const response1 = await app.inject({
            method: "POST",
            url: "/auth/verify-email",
            payload: { token: verificationToken },
        });
        assert.strictEqual(response1.statusCode, 200);

        // 3. Kích hoạt lần 2 (idempotent) -> Vẫn 200 OK
        const response2 = await app.inject({
            method: "POST",
            url: "/auth/verify-email",
            payload: { token: verificationToken },
        });
        assert.strictEqual(response2.statusCode, 200);
        const body = JSON.parse(response2.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.email, "idempotent@example.com");
    });

    await t.test("POST /auth/login - success 200", async () => {
        // 1. Tạo user đã active
        const email = "login.success@example.com";
        const password = "ValidPassword123";
        const passwordHash = await bcrypt.hash(password, 10);

        await prisma.users.create({
            data: {
                id: crypto.randomUUID(),
                email,
                password_hash: passwordHash,
                display_name: "Login Success",
                status: "active",
                email_verified: true,
            }
        });

        // 2. Gọi api login
        const response = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password },
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, true);
        assert.ok(body.data.access_token);
        assert.ok(body.data.refresh_token);
        assert.strictEqual(body.data.user.email, email);

        // 3. Kiểm tra DB: last_login_at và refresh_token
        const user = await prisma.users.findUnique({
            where: { email },
            include: { refresh_tokens: true }
        });
        assert.ok(user?.last_login_at, "last_login_at phải được cập nhật");
        assert.strictEqual(user?.refresh_tokens.length, 1, "Phải có 1 refresh token trong DB");
    });

    await t.test("POST /auth/login - invalid credentials 401", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email: "wrong@example.com", password: "any" },
        });

        assert.strictEqual(response.statusCode, 401);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.error.code, "INVALID_CREDENTIALS");
    });

    await t.test("POST /auth/login - email not verified 403", async () => {
        // 1. Tạo user pending
        const email = "pending@example.com";
        const password = "Password123";
        await prisma.users.create({
            data: {
                id: crypto.randomUUID(),
                email,
                password_hash: await bcrypt.hash(password, 10),
                status: "pending_verification",
            }
        });

        const response = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password },
        });

        assert.strictEqual(response.statusCode, 403);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.error.code, "EMAIL_NOT_VERIFIED");
    });

    await t.test("POST /auth/login - account temporarily locked 429", async () => {
        const email = "bruteforce@example.com";

        // 1. Tạo 10 lượt failed attempts thủ công
        for (let i = 0; i < 10; i++) {
            await prisma.login_attempts.create({
                data: {
                    id: crypto.randomUUID(),
                    email,
                    ip_address: "127.0.0.1",
                    succeeded: false,
                }
            });
        }

        const response = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password: "any" },
        });

        assert.strictEqual(response.statusCode, 429);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.error.code, "ACCOUNT_TEMPORARILY_LOCKED");
    });

    await t.test("POST /auth/logout - success 200", async () => {
        await clearDatabase();
        // 1. Register a user
        const email = "logout@example.com";
        const password = "Password123";
        const regRes = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email,
                password,
                password_confirmation: password,
                display_name: "Logout User",
                accepted_terms: true,
            },
        });
        const regBody = JSON.parse(regRes.body);
        const token = regBody.verificationToken;

        // 2. Verify email
        await app.inject({
            method: "POST",
            url: "/auth/verify-email",
            payload: { token },
        });

        // 3. Login
        const loginRes = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password },
        });
        const loginBody = JSON.parse(loginRes.body);
        const accessToken = loginBody.data.access_token;
        const refreshToken = loginBody.data.refresh_token;

        // 4. Logout
        const logoutRes = await app.inject({
            method: "POST",
            url: "/auth/logout",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            payload: {
                refresh_token: refreshToken,
            },
        });

        assert.strictEqual(logoutRes.statusCode, 200);
        const logoutBody = JSON.parse(logoutRes.body);
        assert.strictEqual(logoutBody.success, true);
        assert.strictEqual(logoutBody.message, "Logged out successfully.");

        // 5. Verify token status in DB
        const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");
        const dbToken = await prisma.refresh_tokens.findUnique({ where: { token_hash: hash } });
        assert.ok(dbToken);
        assert.strictEqual(dbToken.is_revoked, true);
    });

    await t.test("POST /auth/logout - unauthorized 401", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/auth/logout",
            payload: {
                refresh_token: "any-token",
            },
        });

        assert.strictEqual(response.statusCode, 401);
    });

    await t.test("POST /auth/logout - token ownership mismatch 403", async () => {
        await clearDatabase();
        // 1. Register and login User A
        const regResA = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email: "usera@example.com",
                password: "Password123",
                password_confirmation: "Password123",
                display_name: "User A",
                accepted_terms: true,
            },
        });
        const regBodyA = JSON.parse(regResA.body);
        await app.inject({
            method: "POST",
            url: "/auth/verify-email",
            payload: { token: regBodyA.verificationToken },
        });
        const loginResA = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email: "usera@example.com", password: "Password123" },
        });
        const loginBodyA = JSON.parse(loginResA.body);
        const accessTokenA = loginBodyA.data.access_token;

        // 2. Register and login User B
        const regResB = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email: "userb@example.com",
                password: "Password123",
                password_confirmation: "Password123",
                display_name: "User B",
                accepted_terms: true,
            },
        });
        const regBodyB = JSON.parse(regResB.body);
        await app.inject({
            method: "POST",
            url: "/auth/verify-email",
            payload: { token: regBodyB.verificationToken },
        });
        const loginResB = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email: "userb@example.com", password: "Password123" },
        });
        const loginBodyB = JSON.parse(loginResB.body);
        const refreshTokenB = loginBodyB.data.refresh_token;

        // 3. User A tries to log out User B's refresh token
        const response = await app.inject({
            method: "POST",
            url: "/auth/logout",
            headers: {
                Authorization: `Bearer ${accessTokenA}`,
            },
            payload: {
                refresh_token: refreshTokenB,
            },
        });

        assert.strictEqual(response.statusCode, 403);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.error.code, "TOKEN_OWNERSHIP_MISMATCH");
    });

    await t.test("POST /auth/forgot-password - success 200 (existing active user)", async () => {
        // 1. Register a user and verify email to make them active
        const email = "forgot_active@example.com";
        const regRes = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email,
                password: "Password123",
                password_confirmation: "Password123",
                display_name: "Active Forgot",
                accepted_terms: true,
            },
        });
        const regBody = JSON.parse(regRes.body);
        await app.inject({
            method: "POST",
            url: "/auth/verify-email",
            payload: { token: regBody.verificationToken },
        });

        // 2. Request forgot-password
        const response = await app.inject({
            method: "POST",
            url: "/auth/forgot-password",
            payload: { email },
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.message, "If an account with that email exists, a password reset link has been sent.");

        // 3. Verify token was created in DB
        const userInDb = await prisma.users.findUnique({ where: { email } });
        assert.ok(userInDb);
        const tokens = await prisma.password_reset_tokens.findMany({
            where: { user_id: userInDb.id },
        });
        assert.strictEqual(tokens.length, 1);
        assert.ok(tokens[0].token_hash);
        assert.strictEqual(tokens[0].consumed_at, null);
    });

    await t.test("POST /auth/forgot-password - success 200 (non-existent email)", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/auth/forgot-password",
            payload: { email: "doesnotexist@example.com" },
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.message, "If an account with that email exists, a password reset link has been sent.");
    });

    await t.test("POST /auth/forgot-password - validation error 400 (malformed email)", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/auth/forgot-password",
            payload: { email: "invalid-email" },
        });

        assert.strictEqual(response.statusCode, 400);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "VALIDATION_ERROR");
    });

    await t.test("POST /auth/reset-password - integration flow", async (st) => {
        const email = "reset_flow@example.com";
        const oldPassword = "Password123";
        const newPassword = "NewPassword123!";

        // 1. Register and verify user
        const regRes = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email,
                password: oldPassword,
                password_confirmation: oldPassword,
                display_name: "Reset Flow User",
                accepted_terms: true,
            },
        });
        const regBody = JSON.parse(regRes.body);
        await app.inject({
            method: "POST",
            url: "/auth/verify-email",
            payload: { token: regBody.verificationToken },
        });

        // 2. Login to establish a session (so we can verify session revocation on reset)
        const loginRes = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password: oldPassword },
        });
        const loginBody = JSON.parse(loginRes.body);
        const activeRefreshToken = loginBody.data.refresh_token;

        // 3. Create a reset token manually
        const userInDb = await prisma.users.findUnique({ where: { email } });
        assert.ok(userInDb);

        const rawToken = "d41d8cd98f00b204e9800998ecf8427e";
        const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + 3600000); // 1 hr in future

        await prisma.password_reset_tokens.create({
            data: {
                id: crypto.randomUUID(),
                user_id: userInDb.id,
                token_hash: hashedToken,
                expires_at: expiresAt,
            },
        });

        // 4. Reset password using the valid token
        const resetRes = await app.inject({
            method: "POST",
            url: "/auth/reset-password",
            payload: {
                token: rawToken,
                new_password: newPassword,
                new_password_confirmation: newPassword,
            },
        });

        assert.strictEqual(resetRes.statusCode, 200);
        const resetBody = JSON.parse(resetRes.body);
        assert.strictEqual(resetBody.success, true);
        assert.strictEqual(resetBody.message, "Password has been reset successfully. Please log in with your new password.");

        // 5. Verify the token was marked consumed
        const consumedToken = await prisma.password_reset_tokens.findFirst({
            where: { token_hash: hashedToken },
        });
        assert.ok(consumedToken?.consumed_at);

        // 6. Verify that the previous refresh token is now revoked
        const dbRefreshToken = await prisma.refresh_tokens.findUnique({
            where: { token_hash: crypto.createHash("sha256").update(activeRefreshToken).digest("hex") },
        });
        assert.strictEqual(dbRefreshToken?.is_revoked, true);

        // 7. Verify login with old password fails
        const oldLoginRes = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password: oldPassword },
        });
        assert.strictEqual(oldLoginRes.statusCode, 401);

        // 8. Verify login with new password succeeds
        const newLoginRes = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password: newPassword },
        });
        assert.strictEqual(newLoginRes.statusCode, 200);

        // 9. Try resetting again with the same token -> should fail 409
        const rerunRes = await app.inject({
            method: "POST",
            url: "/auth/reset-password",
            payload: {
                token: rawToken,
                new_password: newPassword,
                new_password_confirmation: newPassword,
            },
        });
        assert.strictEqual(rerunRes.statusCode, 409);
        const rerunBody = JSON.parse(rerunRes.body);
        assert.strictEqual(rerunBody.error.code, "TOKEN_ALREADY_USED");

        // 10. Try resetting with same password as current -> should fail 422
        // Let's create another token for this
        const rawToken2 = "e51d8cd98f00b204e9800998ecf8427f";
        const hashedToken2 = crypto.createHash("sha256").update(rawToken2).digest("hex");
        await prisma.password_reset_tokens.create({
            data: {
                id: crypto.randomUUID(),
                user_id: userInDb.id,
                token_hash: hashedToken2,
                expires_at: expiresAt,
            },
        });

        const samePasswordRes = await app.inject({
            method: "POST",
            url: "/auth/reset-password",
            payload: {
                token: rawToken2,
                new_password: newPassword,
                new_password_confirmation: newPassword,
            },
        });
        assert.strictEqual(samePasswordRes.statusCode, 422);
        const samePasswordBody = JSON.parse(samePasswordRes.body);
        assert.strictEqual(samePasswordBody.error.code, "PASSWORD_UNCHANGED");

        // 11. Try resetting with an expired token -> should fail 410
        const rawTokenExpired = "f61d8cd98f00b204e9800998ecf84270";
        const hashedTokenExpired = crypto.createHash("sha256").update(rawTokenExpired).digest("hex");
        await prisma.password_reset_tokens.create({
            data: {
                id: crypto.randomUUID(),
                user_id: userInDb.id,
                token_hash: hashedTokenExpired,
                expires_at: new Date(Date.now() - 3600000), // 1 hour in past
            },
        });

        const expiredRes = await app.inject({
            method: "POST",
            url: "/auth/reset-password",
            payload: {
                token: rawTokenExpired,
                new_password: "AnotherNewPassword123",
                new_password_confirmation: "AnotherNewPassword123",
            },
        });
        assert.strictEqual(expiredRes.statusCode, 410);
        const expiredBody = JSON.parse(expiredRes.body);
        assert.strictEqual(expiredBody.error.code, "TOKEN_EXPIRED");
    });

    await t.test("GET /auth/me - success 200", async () => {
        // 1. Register, verify and login user
        const email = "me.success@example.com";
        const password = "Password123";
        const regRes = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email,
                password,
                password_confirmation: password,
                display_name: "Me Success",
                accepted_terms: true,
                jlpt_target_level: "N3",
            },
        });
        const regBody = JSON.parse(regRes.body);
        await app.inject({
            method: "POST",
            url: "/auth/verify-email",
            payload: { token: regBody.verificationToken },
        });

        const loginRes = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password },
        });
        const loginBody = JSON.parse(loginRes.body);
        const accessToken = loginBody.data.access_token;

        // 2. Call GET /auth/me
        const response = await app.inject({
            method: "GET",
            url: "/auth/me",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.email, email);
        assert.strictEqual(body.data.display_name, "Me Success");
        assert.strictEqual(body.data.role, "user");
        assert.strictEqual(body.data.is_premium, false);
        assert.strictEqual(body.data.jlpt_target_level, "N3");
        assert.strictEqual(body.data.status, "active");
        assert.strictEqual(body.data.timezone, "Asia/Ho_Chi_Minh");
        assert.strictEqual(body.data.locale, "vi-VN");
        assert.ok(body.data.created_at);
        assert.strictEqual(body.data.password_hash, undefined);
    });

    await t.test("GET /auth/me - unauthorized 401 (missing header)", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/auth/me",
        });

        assert.strictEqual(response.statusCode, 401);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "UNAUTHORIZED");
    });

    await t.test("GET /auth/me - unauthorized 401 (expired token)", async () => {
        // Mock jwt.verify to throw TokenExpiredError
        mock.method(jwt, "verify", () => {
            throw new jwt.TokenExpiredError("jwt expired", new Date());
        });

        const response = await app.inject({
            method: "GET",
            url: "/auth/me",
            headers: {
                Authorization: "Bearer expired-token",
            },
        });

        // Restore mock
        mock.restoreAll();

        assert.strictEqual(response.statusCode, 401);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "UNAUTHORIZED");
    });

    await t.test("GET /auth/me - unauthorized 401 (malformed token)", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/auth/me",
            headers: {
                Authorization: "Bearer malformed-token",
            },
        });

        assert.strictEqual(response.statusCode, 401);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "UNAUTHORIZED");
    });

    await t.test("GET /auth/me - unauthorized 401 (since deleted user)", async () => {
        // 1. Register, verify and login user
        const email = "deleted.user@example.com";
        const password = "Password123";
        const regRes = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email,
                password,
                password_confirmation: password,
                display_name: "Soon Deleted",
                accepted_terms: true,
            },
        });
        const regBody = JSON.parse(regRes.body);
        await app.inject({
            method: "POST",
            url: "/auth/verify-email",
            payload: { token: regBody.verificationToken },
        });

        const loginRes = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password },
        });
        const loginBody = JSON.parse(loginRes.body);
        const accessToken = loginBody.data.access_token;

        // 2. Soft delete user in DB
        await prisma.users.update({
            where: { email },
            data: { deleted_at: new Date() },
        });

        // 3. Call GET /auth/me
        const response = await app.inject({
            method: "GET",
            url: "/auth/me",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        assert.strictEqual(response.statusCode, 401);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "UNAUTHORIZED");
    });

    await t.test("GET /auth/me - forbidden 403 (suspended user)", async () => {
        // 1. Register, verify and login user
        const email = "suspended.user@example.com";
        const password = "Password123";
        const regRes = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email,
                password,
                password_confirmation: password,
                display_name: "Suspended",
                accepted_terms: true,
            },
        });
        const regBody = JSON.parse(regRes.body);
        await app.inject({
            method: "POST",
            url: "/auth/verify-email",
            payload: { token: regBody.verificationToken },
        });

        const loginRes = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password },
        });
        const loginBody = JSON.parse(loginRes.body);
        const accessToken = loginBody.data.access_token;

        // 2. Suspend user in DB
        await prisma.users.update({
            where: { email },
            data: { status: "suspended" },
        });

        // 3. Call GET /auth/me
        const response = await app.inject({
            method: "GET",
            url: "/auth/me",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        assert.strictEqual(response.statusCode, 403);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "ACCOUNT_SUSPENDED");
    });

    await t.test("GET /auth/me - forbidden 403 (banned user)", async () => {
        // 1. Register, verify and login user
        const email = "banned.user@example.com";
        const password = "Password123";
        const regRes = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email,
                password,
                password_confirmation: password,
                display_name: "Banned",
                accepted_terms: true,
            },
        });
        const regBody = JSON.parse(regRes.body);
        await app.inject({
            method: "POST",
            url: "/auth/verify-email",
            payload: { token: regBody.verificationToken },
        });

        const loginRes = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password },
        });
        const loginBody = JSON.parse(loginRes.body);
        const accessToken = loginBody.data.access_token;

        // 2. Ban user in DB
        await prisma.users.update({
            where: { email },
            data: { status: "banned" },
        });

        // 3. Call GET /auth/me
        const response = await app.inject({
            method: "GET",
            url: "/auth/me",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        assert.strictEqual(response.statusCode, 403);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "ACCOUNT_BANNED");
    });

    await t.test("GET /auth/me - tampered signature 401", async () => {
        // 1. Register, verify and login user
        const email = "tamper@example.com";
        const password = "Password123";
        const regRes = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email,
                password,
                password_confirmation: password,
                display_name: "Tamper",
                accepted_terms: true,
            },
        });
        const regBody = JSON.parse(regRes.body);
        await app.inject({
            method: "POST",
            url: "/auth/verify-email",
            payload: { token: regBody.verificationToken },
        });

        const loginRes = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password },
        });
        const loginBody = JSON.parse(loginRes.body);
        const accessToken = loginBody.data.access_token;

        // 2. Tamper with signature part of JWT
        const parts = accessToken.split(".");
        const tamperedSignature = parts[2] ? parts[2].substring(0, parts[2].length - 4) + "AAAA" : "AAAA";
        const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSignature}`;

        // 3. Call GET /auth/me
        const response = await app.inject({
            method: "GET",
            url: "/auth/me",
            headers: {
                Authorization: `Bearer ${tamperedToken}`,
            },
        });

        assert.strictEqual(response.statusCode, 401);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "UNAUTHORIZED");
    });

    await t.test("GET /auth/me - idempotency check", async () => {
        // 1. Register, verify and login user
        const email = "idemp@example.com";
        const password = "Password123";
        const regRes = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email,
                password,
                password_confirmation: password,
                display_name: "Idemp",
                accepted_terms: true,
            },
        });
        const regBody = JSON.parse(regRes.body);
        await app.inject({
            method: "POST",
            url: "/auth/verify-email",
            payload: { token: regBody.verificationToken },
        });

        const loginRes = await app.inject({
            method: "POST",
            url: "/auth/login",
            payload: { email, password },
        });
        const loginBody = JSON.parse(loginRes.body);
        const accessToken = loginBody.data.access_token;

        // 2. Call GET /auth/me multiple times
        for (let i = 0; i < 3; i++) {
            const response = await app.inject({
                method: "GET",
                url: "/auth/me",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            assert.strictEqual(response.statusCode, 200);
            const body = JSON.parse(response.body);
            assert.strictEqual(body.success, true);
            assert.strictEqual(body.data.email, email);
        }
    });
});



