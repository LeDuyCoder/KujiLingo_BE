import { test, beforeEach, after } from "node:test";
import assert from "node:assert";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";

async function clearDatabase() {
    // Xóa theo thứ tự để tránh khóa ngoại (foreign key)
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
                email: "newuser@example.com",
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
        assert.strictEqual(body.user.email, "newuser@example.com");
        assert.ok(body.verificationToken);

        // Kiểm tra thực tế trong DB
        const userInDb = await prisma.users.findUnique({ where: { email: "newuser@example.com" } });
        assert.ok(userInDb, "User phải được lưu trong DB");
    });

    await t.test("POST /auth/register - validation error 400", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/auth/register",
            payload: {
                email: "newuser@example.com",
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
});
