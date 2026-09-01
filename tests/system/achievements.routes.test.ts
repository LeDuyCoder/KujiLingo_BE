import { test, beforeEach, after } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { signToken } from "../../src/common/utils/jwt.js";

// Keep track of created entities to clean up without wiping user database
let createdUserIds: string[] = [];
let createdAchievementIds: string[] = [];

async function cleanupTestData() {
    if (createdUserIds.length > 0) {
        await prisma.user_achievement_showcase.deleteMany({
            where: { user_id: { in: createdUserIds } }
        });
        await prisma.user_achievements.deleteMany({
            where: { user_id: { in: createdUserIds } }
        });
        await prisma.users.deleteMany({
            where: { id: { in: createdUserIds } }
        });
        createdUserIds = [];
    }
    if (createdAchievementIds.length > 0) {
        await prisma.user_achievement_showcase.deleteMany({
            where: { achievement_id: { in: createdAchievementIds } }
        });
        await prisma.user_achievements.deleteMany({
            where: { achievement_id: { in: createdAchievementIds } }
        });
        await prisma.achievements.deleteMany({
            where: { id: { in: createdAchievementIds } }
        });
        createdAchievementIds = [];
    }
}

test("Achievements API System Tests", async (t) => {
    let testUser: any;
    let userToken: string;
    let adminUser: any;
    let adminToken: string;

    beforeEach(async () => {
        await app.ready();
        await cleanupTestData();

        // Create standard test user
        const uId = crypto.randomUUID();
        testUser = await prisma.users.create({
            data: {
                id: uId,
                email: `achievtest_user_${Date.now()}_${Math.random()}@example.com`,
                password_hash: "hashed",
                display_name: "Standard User",
                role: "user",
                status: "active",
                streak: 2,
                exp: 10,
            },
        });
        createdUserIds.push(uId);
        userToken = signToken({ sub: testUser.id, role: testUser.role });

        // Create admin test user
        const aId = crypto.randomUUID();
        adminUser = await prisma.users.create({
            data: {
                id: aId,
                email: `achievtest_admin_${Date.now()}_${Math.random()}@example.com`,
                password_hash: "hashed",
                display_name: "Admin User",
                role: "admin",
                status: "active",
            },
        });
        createdUserIds.push(aId);
        adminToken = signToken({ sub: adminUser.id, role: adminUser.role });
    });

    after(async () => {
        await cleanupTestData();
        await app.close();
        await prisma.$disconnect();
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
        createdAchievementIds.push(body.data.id);
        assert.strictEqual(body.data.title, "5-Day Streak");
        assert.strictEqual(body.data.condition_value, 5);
        assert.strictEqual(body.data.reward_exp, 100);
    });

    // =========================================================================
    // 2. PATCH /api/v1/achievements/:achievementId (Admin Update Achievement)
    // =========================================================================
    await t.test("PATCH /api/v1/achievements/:achievementId - 200 Success for admin", async () => {
        const achId = crypto.randomUUID();
        const createRes = await prisma.achievements.create({
            data: {
                id: achId,
                title: "Initial Title",
                description: "Initial description",
                icon: "initial.png",
                type: "EXP",
                condition_value: 500,
                reward_exp: 50,
            },
        });
        createdAchievementIds.push(achId);

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
        await prisma.users.update({
            where: { id: testUser.id },
            data: { streak: 10, exp: 10 }
        });

        const achId1 = crypto.randomUUID();
        const ach1 = await prisma.achievements.create({
            data: {
                id: achId1,
                title: "Streak Hero",
                description: "10-Day streak",
                icon: "streak10.png",
                type: "STREAK",
                condition_value: 5,
                reward_exp: 100,
            }
        });
        createdAchievementIds.push(achId1);

        const achId2 = crypto.randomUUID();
        const ach2 = await prisma.achievements.create({
            data: {
                id: achId2,
                title: "EXP Millionaire",
                description: "Get 100 EXP",
                icon: "exp100.png",
                type: "EXP",
                condition_value: 100,
                reward_exp: 50,
            }
        });
        createdAchievementIds.push(achId2);

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

        const item1 = body.data.items.find((i: any) => i.id === ach1.id);
        const item2 = body.data.items.find((i: any) => i.id === ach2.id);

        assert.ok(item1);
        assert.ok(item2);
        assert.strictEqual(item1.is_unlocked, true);
        assert.strictEqual(item2.is_unlocked, true);

        const dbUser = await prisma.users.findUnique({
            where: { id: testUser.id }
        });
        assert.ok((dbUser?.exp ?? 0) >= 160);
    });

    // =========================================================================
    // 4. GET /api/v1/achievements/me
    // =========================================================================
    await t.test("GET /api/v1/achievements/me - Grouped and sorted correctly", async () => {
        await prisma.users.update({
            where: { id: testUser.id },
            data: { streak: 5, exp: 10 }
        });

        const achId1 = crypto.randomUUID();
        await prisma.achievements.create({
            data: {
                id: achId1,
                title: "Streak 3",
                description: "3 streak",
                icon: "streak3.png",
                type: "STREAK",
                condition_value: 3,
                reward_exp: 10,
            }
        });
        createdAchievementIds.push(achId1);

        const achId2 = crypto.randomUUID();
        await prisma.achievements.create({
            data: {
                id: achId2,
                title: "Streak 10",
                description: "10 streak",
                icon: "streak10.png",
                type: "STREAK",
                condition_value: 10,
                reward_exp: 10,
            }
        });
        createdAchievementIds.push(achId2);

        const achId3 = crypto.randomUUID();
        await prisma.achievements.create({
            data: {
                id: achId3,
                title: "Vocab Master 100",
                description: "Master 100 vocab words",
                icon: "vocab100.png",
                type: "VOCAB_MASTER",
                condition_value: 100,
                reward_exp: 10,
            }
        });
        createdAchievementIds.push(achId3);

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
        assert.ok(body.data.summary.unlocked_count >= 1);
        assert.ok(body.data.summary.in_progress_count >= 1);
        assert.ok(body.data.summary.not_started_count >= 1);
    });

    // =========================================================================
    // 5. GET /api/v1/achievements/me/:achievementId
    // =========================================================================
    await t.test("GET /api/v1/achievements/me/:achievementId - Returns correct detail payload", async () => {
        const achId = crypto.randomUUID();
        const ach = await prisma.achievements.create({
            data: {
                id: achId,
                title: "Detail Test",
                description: "Test description",
                icon: "test.png",
                type: "STREAK",
                condition_value: 10,
                reward_exp: 20,
            }
        });
        createdAchievementIds.push(achId);

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
        assert.strictEqual(body.data.remaining_value, 8);
        assert.strictEqual(body.data.progress_percent, 20);
    });

    // =========================================================================
    // 6. Showcase Endpoints (My Showcase, User Showcase, Update Showcase)
    // =========================================================================
    await t.test("Showcase Endpoints Integration Flow", async () => {
        // Create 2 achievements
        const achId1 = crypto.randomUUID();
        const ach1 = await prisma.achievements.create({
            data: {
                id: achId1,
                title: "Showcase Streak",
                description: "Streak achievement",
                icon: "badge1.png",
                type: "STREAK",
                condition_value: 1,
                reward_exp: 10,
            }
        });
        createdAchievementIds.push(achId1);

        const achId2 = crypto.randomUUID();
        const ach2 = await prisma.achievements.create({
            data: {
                id: achId2,
                title: "Showcase EXP",
                description: "EXP achievement",
                icon: "badge2.png",
                type: "EXP",
                condition_value: 5,
                reward_exp: 10,
            }
        });
        createdAchievementIds.push(achId2);

        // Unlock only ach1 for standard user
        await prisma.user_achievements.create({
            data: {
                user_id: testUser.id,
                achievement_id: ach1.id,
                unlocked_at: new Date(),
            }
        });

        // 1. GET /api/v1/achievements/showcase/me - Empty at start
        let showcaseRes = await app.inject({
            method: "GET",
            url: "/api/v1/achievements/showcase/me",
            headers: { authorization: `Bearer ${userToken}` }
        });
        assert.strictEqual(showcaseRes.statusCode, 200);
        let showcaseBody = JSON.parse(showcaseRes.body);
        assert.strictEqual(showcaseBody.success, true);
        assert.strictEqual(showcaseBody.data.count, 0);

        // 2. PATCH /api/v1/users/me/profile/showcase-achievement - Select unlocked achievement (ach1)
        let updateRes = await app.inject({
            method: "PATCH",
            url: "/api/v1/users/me/profile/showcase-achievement",
            headers: { authorization: `Bearer ${userToken}` },
            payload: {
                achievement_id: ach1.id,
                slot: 1
            }
        });
        assert.strictEqual(updateRes.statusCode, 200);
        let updateBody = JSON.parse(updateRes.body);
        assert.strictEqual(updateBody.success, true);
        assert.deepStrictEqual(updateBody.data.achievement_ids, [ach1.id]);

        // Try selecting locked achievement (ach2) -> 400 Bad Request
        let updateFailRes = await app.inject({
            method: "PATCH",
            url: "/api/v1/users/me/profile/showcase-achievement",
            headers: { authorization: `Bearer ${userToken}` },
            payload: {
                achievement_id: ach2.id,
                slot: 2
            }
        });
        assert.strictEqual(updateFailRes.statusCode, 400);

        // 3. GET /api/v1/achievements/showcase/me - Returns 1 item now
        showcaseRes = await app.inject({
            method: "GET",
            url: "/api/v1/achievements/showcase/me",
            headers: { authorization: `Bearer ${userToken}` }
        });
        assert.strictEqual(showcaseRes.statusCode, 200);
        showcaseBody = JSON.parse(showcaseRes.body);
        assert.strictEqual(showcaseBody.data.count, 1);
        assert.strictEqual(showcaseBody.data.items[0].id, ach1.id);
        assert.strictEqual(showcaseBody.data.items[0].slot, 1);

        // 4. GET /api/v1/users/:userId/achievements/showcase - Public showcase view
        let publicRes = await app.inject({
            method: "GET",
            url: `/api/v1/users/${testUser.id}/achievements/showcase`,
            headers: { authorization: `Bearer ${adminToken}` }
        });
        assert.strictEqual(publicRes.statusCode, 200);
        let publicBody = JSON.parse(publicRes.body);
        assert.strictEqual(publicBody.success, true);
        assert.strictEqual(publicBody.data.user_id, testUser.id);
        assert.strictEqual(publicBody.data.count, 1);
        assert.strictEqual(publicBody.data.items[0].id, ach1.id);

        // Bulk update showcase with empty list -> Clears showcase
        updateRes = await app.inject({
            method: "PATCH",
            url: "/api/v1/users/me/profile/showcase-achievement",
            headers: { authorization: `Bearer ${userToken}` },
            payload: {
                achievement_ids: []
            }
        });
        assert.strictEqual(updateRes.statusCode, 200);
        updateBody = JSON.parse(updateRes.body);
        assert.deepStrictEqual(updateBody.data.achievement_ids, []);
    });
});
