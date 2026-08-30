import { test, beforeEach, after } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { signToken } from "../../src/common/utils/jwt.js";

async function clearDatabase() {
    await prisma.favorite_vocabularies.deleteMany({});
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
    await prisma.folders.deleteMany({});
    await prisma.pvp_match_histories.deleteMany({});
    await prisma.user_pvp_statistics.deleteMany({});
    await prisma.purchase_histories.deleteMany({});
    await prisma.payment_transactions.deleteMany({});
    await prisma.srs_review_histories.deleteMany({});
    await prisma.srs_cards.deleteMany({});
    await prisma.leaderboard_snapshots.deleteMany({});
    await prisma.admin_audit_logs.deleteMany({});
    await prisma.achievements.deleteMany({});
    await prisma.users.deleteMany({});
}

test("Achievements API System Tests", async (t) => {
    let testUser: any;
    let userToken: string;
    let adminUser: any;
    let adminToken: string;

    beforeEach(async () => {
        await app.ready();
        await clearDatabase();

        // Create standard test user
        testUser = await prisma.users.create({
            data: {
                id: crypto.randomUUID(),
                email: `achievtest_user_${Date.now()}_${Math.random()}@example.com`,
                password_hash: "hashed",
                display_name: "Standard User",
                role: "user",
                status: "active",
                streak: 2,
                exp: 10,
            },
        });
        userToken = signToken({ sub: testUser.id, role: testUser.role });

        // Create admin test user
        adminUser = await prisma.users.create({
            data: {
                id: crypto.randomUUID(),
                email: `achievtest_admin_${Date.now()}_${Math.random()}@example.com`,
                password_hash: "hashed",
                display_name: "Admin User",
                role: "admin",
                status: "active",
            },
        });
        adminToken = signToken({ sub: adminUser.id, role: adminUser.role });
    });

    after(async () => {
        await clearDatabase();
    });

    // =========================================================================
    // 1. POST /api/v1/achievements (Admin Create Achievement)
    // =========================================================================
    await t.test("POST /api/v1/achievements - 401 Unauthenticated", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/api/v1/achievements",
            payload: {
                title: "Test Achievement",
                description: "Test description",
                icon: "test.png",
                type: "STREAK",
                condition_value: 5,
                reward_exp: 100,
            },
        });

        assert.strictEqual(res.statusCode, 401);
    });

    await t.test("POST /api/v1/achievements - 403 Forbidden for normal user", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/api/v1/achievements",
            headers: {
                authorization: `Bearer ${userToken}`,
            },
            payload: {
                title: "Test Achievement",
                description: "Test description",
                icon: "test.png",
                type: "STREAK",
                condition_value: 5,
                reward_exp: 100,
            },
        });

        assert.strictEqual(res.statusCode, 403);
    });

    await t.test("POST /api/v1/achievements - 201 Created for admin", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/api/v1/achievements",
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
            payload: {
                title: "5-Day Streak",
                description: "Study for 5 consecutive days.",
                icon: "streak5.png",
                type: "STREAK",
                condition_value: 5,
                reward_exp: 100,
            },
        });

        assert.strictEqual(res.statusCode, 201);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.ok(body.data.id);
        assert.strictEqual(body.data.title, "5-Day Streak");
        assert.strictEqual(body.data.condition_value, 5);
        assert.strictEqual(body.data.reward_exp, 100);
    });

    await t.test("POST /api/v1/achievements - 400 Bad Request on duplicate creation", async () => {
        // Create first
        await app.inject({
            method: "POST",
            url: "/api/v1/achievements",
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
            payload: {
                title: "Duplicate Test",
                description: "Test",
                icon: "dup.png",
                type: "STREAK",
                condition_value: 10,
                reward_exp: 50,
            },
        });

        // Try again
        const res = await app.inject({
            method: "POST",
            url: "/api/v1/achievements",
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
            payload: {
                title: "Duplicate Test",
                description: "Test",
                icon: "dup.png",
                type: "STREAK",
                condition_value: 10,
                reward_exp: 50,
            },
        });

        assert.strictEqual(res.statusCode, 400);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "DUPLICATE_ACHIEVEMENT");
    });

    // =========================================================================
    // 2. PATCH /api/v1/achievements/:achievementId (Admin Update Achievement)
    // =========================================================================
    await t.test("PATCH /api/v1/achievements/:achievementId - 200 Success for admin", async () => {
        const createRes = await prisma.achievements.create({
            data: {
                id: crypto.randomUUID(),
                title: "Initial Title",
                description: "Initial description",
                icon: "initial.png",
                type: "EXP",
                condition_value: 500,
                reward_exp: 50,
            },
        });

        const res = await app.inject({
            method: "PATCH",
            url: `/api/v1/achievements/${createRes.id}`,
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
            payload: {
                title: "Updated Title",
                description: "Updated description",
                icon: "updated.png",
                reward_exp: 100,
            },
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.title, "Updated Title");
        assert.strictEqual(body.data.description, "Updated description");
        assert.strictEqual(body.data.reward_exp, 100);
    });

    // =========================================================================
    // 3. GET /api/v1/achievements/catalog & Auto-Unlock Cascade
    // =========================================================================
    await t.test("GET /api/v1/achievements/catalog - Returns definitions and auto-unlocks cascades", async () => {
        // Define achievements:
        // 1. Streak 5 (met: testUser streak is 2, wait, let's create user with streak: 10)
        // 2. EXP 100 (needs 100 exp. TestUser starts with 10 exp. BUT if they unlock a streak achievement that gives 100 EXP, their EXP becomes 110. This should automatically cascade and unlock the EXP achievement as well!)
        
        await prisma.users.update({
            where: { id: testUser.id },
            data: { streak: 10, exp: 10 }
        });

        const ach1 = await prisma.achievements.create({
            data: {
                id: crypto.randomUUID(),
                title: "Streak Hero",
                description: "10-Day streak",
                icon: "streak10.png",
                type: "STREAK",
                condition_value: 5,
                reward_exp: 100, // awards 100 EXP!
            }
        });

        const ach2 = await prisma.achievements.create({
            data: {
                id: crypto.randomUUID(),
                title: "EXP Millionaire",
                description: "Get 100 EXP",
                icon: "exp100.png",
                type: "EXP",
                condition_value: 100,
                reward_exp: 50,
            }
        });

        const res = await app.inject({
            method: "GET",
            url: "/api/v1/achievements/catalog",
            headers: {
                authorization: `Bearer ${userToken}`,
            },
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.items.length, 2);

        const item1 = body.data.items.find((i: any) => i.id === ach1.id);
        const item2 = body.data.items.find((i: any) => i.id === ach2.id);

        // Verify both are unlocked (due to cascade)
        assert.strictEqual(item1.is_unlocked, true);
        assert.strictEqual(item2.is_unlocked, true);

        // Verify the user exp in the database was updated: 10 + 100 + 50 = 160
        const dbUser = await prisma.users.findUnique({
            where: { id: testUser.id }
        });
        assert.strictEqual(dbUser?.exp, 160);
    });

    // =========================================================================
    // 4. GET /api/v1/achievements/me
    // =========================================================================
    await t.test("GET /api/v1/achievements/me - Grouped and sorted correctly", async () => {
        // Create 3 achievements:
        // - Unlocked (condition met)
        // - In progress (progress > 0)
        // - Not started (progress = 0)
        
        await prisma.users.update({
            where: { id: testUser.id },
            data: { streak: 5, exp: 10 }
        });

        const achUnlocked = await prisma.achievements.create({
            data: {
                id: crypto.randomUUID(),
                title: "Streak 3",
                description: "3 streak",
                icon: "streak3.png",
                type: "STREAK",
                condition_value: 3,
                reward_exp: 10,
            }
        });

        const achInProgress = await prisma.achievements.create({
            data: {
                id: crypto.randomUUID(),
                title: "Streak 10",
                description: "10 streak",
                icon: "streak10.png",
                type: "STREAK",
                condition_value: 10,
                reward_exp: 10,
            }
        });

        const achNotStarted = await prisma.achievements.create({
            data: {
                id: crypto.randomUUID(),
                title: "Vocab Master 100",
                description: "Master 100 vocab words",
                icon: "vocab100.png",
                type: "VOCAB_MASTER",
                condition_value: 100,
                reward_exp: 10,
            }
        });

        const res = await app.inject({
            method: "GET",
            url: "/api/v1/achievements/me",
            headers: {
                authorization: `Bearer ${userToken}`,
            },
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.summary.unlocked_count, 1);
        assert.strictEqual(body.data.summary.in_progress_count, 1);
        assert.strictEqual(body.data.summary.not_started_count, 1);

        // Verify status sorting: unlocked -> in_progress -> not_started
        assert.strictEqual(body.data.items[0].status, "unlocked");
        assert.strictEqual(body.data.items[1].status, "in_progress");
        assert.strictEqual(body.data.items[2].status, "not_started");
    });

    // =========================================================================
    // 5. GET /api/v1/achievements/me/:achievementId
    // =========================================================================
    await t.test("GET /api/v1/achievements/me/:achievementId - Returns correct detail payload", async () => {
        const ach = await prisma.achievements.create({
            data: {
                id: crypto.randomUUID(),
                title: "Detail Test",
                description: "Test description",
                icon: "test.png",
                type: "STREAK",
                condition_value: 10,
                reward_exp: 20,
            }
        });

        const res = await app.inject({
            method: "GET",
            url: `/api/v1/achievements/me/${ach.id}`,
            headers: {
                authorization: `Bearer ${userToken}`,
            },
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.id, ach.id);
        assert.strictEqual(body.data.remaining_value, 8); // condition 10 - streak 2 = 8 remaining
        assert.strictEqual(body.data.progress_percent, 20); // 2/10 = 20%
    });
});
