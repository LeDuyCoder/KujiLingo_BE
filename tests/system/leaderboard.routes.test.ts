import { test, beforeEach, after } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { memoryCache } from "../../src/common/utils/cache.js";

async function clearDatabase() {
    // Delete in order to satisfy foreign keys
    await prisma.leaderboard_snapshots.deleteMany({});
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
    await prisma.admin_audit_logs.deleteMany({});
    await prisma.login_attempts.deleteMany({});
    await prisma.refresh_tokens.deleteMany({});
    await prisma.password_reset_tokens.deleteMany({});
    await prisma.email_verification_tokens.deleteMany({});
    await prisma.lessons.deleteMany({});
    await prisma.courses.deleteMany({});
    await prisma.folders.deleteMany({});
    await prisma.users.deleteMany({});
}

async function createAuthenticatedUser(email: string) {
    const password = "Password123";
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await prisma.users.create({
        data: {
            id: userId,
            email,
            password_hash: passwordHash,
            display_name: "Leaderboard User",
            status: "active",
            role: "user",
            email_verified: true,
        },
    });

    const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password },
    });

    const body = JSON.parse(loginRes.body);
    return {
        id: userId,
        token: body.data.access_token,
    };
}

test("Leaderboard API System Tests", async (t) => {
    beforeEach(async () => {
        await clearDatabase();
        memoryCache.clear();
    });

    after(async () => {
        await clearDatabase();
        memoryCache.clear();
    });

    await t.test("GET /api/v1/leaderboard - 401 Unauthenticated", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/leaderboard",
        });

        assert.strictEqual(res.statusCode, 401);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "UNAUTHORIZED");
    });

    await t.test("GET /api/v1/leaderboard - 400 Bad Request on invalid period_type", async () => {
        const user = await createAuthenticatedUser("user@example.com");

        const res = await app.inject({
            method: "GET",
            url: "/api/v1/leaderboard?period_type=invalid",
            headers: { Authorization: `Bearer ${user.token}` },
        });

        assert.strictEqual(res.statusCode, 400);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "VALIDATION_ERROR");
    });

    await t.test("GET /api/v1/leaderboard - 400 Bad Request on limit out of range", async () => {
        const user = await createAuthenticatedUser("user@example.com");

        const res = await app.inject({
            method: "GET",
            url: "/api/v1/leaderboard?limit=101",
            headers: { Authorization: `Bearer ${user.token}` },
        });

        assert.strictEqual(res.statusCode, 400);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "VALIDATION_ERROR");
    });

    await t.test("GET /api/v1/leaderboard - 200 OK returns leaderboard and current user", async () => {
        const user1 = await createAuthenticatedUser("user1@example.com");
        
        // Let's create another user to be on the leaderboard
        const user2Id = crypto.randomUUID();
        await prisma.users.create({
            data: {
                id: user2Id,
                email: "user2@example.com",
                display_name: "Top User",
                status: "active",
                role: "user",
            },
        });

        // Resolve current week period_key using server time (e.g. daily/weekly/etc)
        // Let's seed both users snapshots
        const date = new Date();
        const year = date.getUTCFullYear();
        
        // Find ISO week number
        // Simple approximation or we can get the actual period key resolved by service
        // Let's just resolve it dynamically to be safe!
        const { leaderboardService } = await import("../../src/modules/leaderboard/leaderboard.service.js");
        const weeklyKey = leaderboardService._resolvePeriodKey("weekly", date);

        // Seed snapshot database entries
        await prisma.leaderboard_snapshots.createMany({
            data: [
                {
                    id: crypto.randomUUID(),
                    period_type: "weekly",
                    period_key: weeklyKey,
                    rank: 1,
                    user_id: user2Id,
                    display_name: "Top User",
                    xp_total: 1500,
                },
                {
                    id: crypto.randomUUID(),
                    period_type: "weekly",
                    period_key: weeklyKey,
                    rank: 2,
                    user_id: user1.id,
                    display_name: "Leaderboard User",
                    xp_total: 500,
                },
            ],
        });

        const res = await app.inject({
            method: "GET",
            url: `/api/v1/leaderboard?period_type=weekly&limit=10`,
            headers: { Authorization: `Bearer ${user1.token}` },
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.period_type, "weekly");
        assert.strictEqual(body.data.period_key, weeklyKey);
        assert.strictEqual(body.data.entries.length, 2);
        assert.strictEqual(body.data.entries[0].rank, 1);
        assert.strictEqual(body.data.entries[0].user_id, user2Id);
        assert.strictEqual(body.data.entries[0].display_name, "Top User");
        assert.strictEqual(body.data.entries[0].xp_total, 1500);

        assert.strictEqual(body.data.entries[1].rank, 2);
        assert.strictEqual(body.data.entries[1].user_id, user1.id);

        assert.deepStrictEqual(body.data.current_user, {
            rank: 2,
            xp_total: 500,
        });
    });
});
