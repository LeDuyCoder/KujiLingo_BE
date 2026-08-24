import { test, before, after } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { signToken } from "../../src/common/utils/jwt.js";

async function clearDatabase() {
    await prisma.favorite_vocabularies.deleteMany({});
    await prisma.grammar_points.deleteMany({});
    await prisma.wallet_histories.deleteMany({});
    await prisma.payment_transactions.deleteMany({});
    await prisma.user_wallets.deleteMany({});
    await prisma.user_achievements.deleteMany({});
    await prisma.learning_progress.deleteMany({});
    await prisma.review_histories.deleteMany({});
    await prisma.user_vocabularies.deleteMany({});
    await prisma.user_shop_items.deleteMany({});
    await prisma.user_equipped_items.deleteMany({});
    await prisma.user_statistics_daily.deleteMany({});
    await prisma.admin_audit_logs.deleteMany({});
    await prisma.login_attempts.deleteMany({});
    await prisma.refresh_tokens.deleteMany({});
    await prisma.password_reset_tokens.deleteMany({});
    await prisma.email_verification_tokens.deleteMany({});
    await prisma.users.deleteMany({});
}

async function createUserInDb(email: string, role: string = "user", status: string = "active") {
    const password = "Password123";
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await prisma.users.create({
        data: {
            id: userId,
            email,
            password_hash: passwordHash,
            display_name: `Test ${role}`,
            status,
            role,
            email_verified: true,
        },
    });

    return { id: userId, password };
}

async function createAuthenticatedUser(email: string, role: string = "user", status: string = "active") {
    await app.ready();
    const { id, password } = await createUserInDb(email, role, status);
    const token = signToken({ sub: id, role });
    return {
        id,
        token,
        refresh_token: "mock-refresh-token",
    };
}

test("Admin API - Database Integration Tests", async (t) => {
    before(async () => {
        await app.ready();
    });

    after(async () => {
        await clearDatabase();
    });

    await t.test("GET /admin/users - success 200 (admin access)", async () => {
        await clearDatabase();
        const admin = await createAuthenticatedUser("admin@example.com", "admin");
        await createAuthenticatedUser("user@example.com", "user");

        const response = await app.inject({
            method: "GET",
            url: "/admin/users",
            headers: {
                Authorization: `Bearer ${admin.token}`,
            },
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.length, 2); // 1 admin, 1 user
        assert.strictEqual(body.meta.total, 2);
    });

    await t.test("GET /admin/users - forbidden 403 (regular user access)", async () => {
        await clearDatabase();
        const user = await createAuthenticatedUser("user@example.com", "user");

        const response = await app.inject({
            method: "GET",
            url: "/admin/users",
            headers: {
                Authorization: `Bearer ${user.token}`,
            },
        });

        assert.strictEqual(response.statusCode, 403);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "FORBIDDEN");
    });

    await t.test("GET /admin/users - filter by status", async () => {
        await clearDatabase();
        const admin = await createAuthenticatedUser("admin@example.com", "admin");
        await createUserInDb("suspended@example.com", "user", "suspended");

        const response = await app.inject({
            method: "GET",
            url: "/admin/users?status=suspended",
            headers: {
                Authorization: `Bearer ${admin.token}`,
            },
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.data.length, 1);
        assert.strictEqual(body.data[0].email, "suspended@example.com");
    });

    await t.test("GET /admin/users/:id - success 200", async () => {
        await clearDatabase();
        const admin = await createAuthenticatedUser("admin@example.com", "admin");
        const target = await createAuthenticatedUser("target@example.com", "user");

        const response = await app.inject({
            method: "GET",
            url: `/admin/users/${target.id}`,
            headers: {
                Authorization: `Bearer ${admin.token}`,
            },
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.id, target.id);
        assert.strictEqual(body.data.total_reviews, 0);
        assert.strictEqual(body.data.pvp_matches, 0);
        assert.strictEqual(body.data.pvp_rating, 0);
    });

    await t.test("PUT /admin/users/:id/status - success 200", async () => {
        await clearDatabase();
        const admin = await createAuthenticatedUser("admin@example.com", "admin");
        const target = await createAuthenticatedUser("target@example.com", "user");

        const response = await app.inject({
            method: "PUT",
            url: `/admin/users/${target.id}/status`,
            headers: {
                Authorization: `Bearer ${admin.token}`,
            },
            payload: {
                status: "suspended",
                reason: "Spam behavior",
            },
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.status, "suspended");

        // Verify status changed in DB
        const dbUser = await prisma.users.findUnique({ where: { id: target.id } });
        assert.strictEqual(dbUser?.status, "suspended");

        // Verify session revoked
        const sessions = await prisma.refresh_tokens.findMany({
            where: { user_id: target.id, is_revoked: false }
        });
        assert.strictEqual(sessions.length, 0);

        // Verify audit log written
        const logs = await prisma.admin_audit_logs.findMany({
            where: { admin_id: admin.id }
        });
        assert.strictEqual(logs.length, 1);
        assert.strictEqual(logs[0].action, "user.status_changed");
        assert.deepStrictEqual(logs[0].before_state, { status: "active" });
    });

    await t.test("PUT /admin/users/:id/status - cannot modify self 422", async () => {
        await clearDatabase();
        const admin = await createAuthenticatedUser("admin@example.com", "admin");

        const response = await app.inject({
            method: "PUT",
            url: `/admin/users/${admin.id}/status`,
            headers: {
                Authorization: `Bearer ${admin.token}`,
            },
            payload: {
                status: "suspended",
            },
        });

        assert.strictEqual(response.statusCode, 422);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.error.code, "CANNOT_MODIFY_SELF");
    });

    await t.test("PUT /admin/users/:id/role - promote to admin", async () => {
        await clearDatabase();
        const admin = await createAuthenticatedUser("admin@example.com", "admin");
        const target = await createAuthenticatedUser("target@example.com", "user");

        const response = await app.inject({
            method: "PUT",
            url: `/admin/users/${target.id}/role`,
            headers: {
                Authorization: `Bearer ${admin.token}`,
            },
            payload: {
                role: "admin",
            },
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.data.role, "admin");

        const dbUser = await prisma.users.findUnique({ where: { id: target.id } });
        assert.strictEqual(dbUser?.role, "admin");
    });

    await t.test("GET /admin/audit-logs - success 200", async () => {
        await clearDatabase();
        const admin = await createAuthenticatedUser("admin@example.com", "admin");
        const target = await createAuthenticatedUser("target@example.com", "user");

        // Trigger action that writes audit logs
        await app.inject({
            method: "PUT",
            url: `/admin/users/${target.id}/status`,
            headers: {
                Authorization: `Bearer ${admin.token}`,
            },
            payload: {
                status: "suspended",
                reason: "Suspicious activity",
            },
        });

        const response = await app.inject({
            method: "GET",
            url: "/admin/audit-logs",
            headers: {
                Authorization: `Bearer ${admin.token}`,
            },
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.data.length, 1);
        assert.strictEqual(body.data[0].admin_name, "Test admin");
        assert.strictEqual(body.data[0].action, "user.status_changed");
    });
});
