import { test, beforeEach, after } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";

async function clearDatabase() {
    await prisma.leaderboard_snapshots.deleteMany({});
    await prisma.favorite_vocabularies.deleteMany({});
    await prisma.grammar_points.deleteMany({});
    await prisma.payment_transactions.deleteMany({});
    await prisma.wallet_histories.deleteMany({});
    await prisma.user_wallets.deleteMany({});
    await prisma.user_achievements.deleteMany({});
    await prisma.purchase_histories.deleteMany({});
    await prisma.pvp_match_histories.deleteMany({});
    await prisma.srs_review_histories.deleteMany({});
    await prisma.srs_cards.deleteMany({});
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
    await prisma.quiz_answers.deleteMany({});
    await prisma.quiz_questions.deleteMany({});
    await prisma.quizzes.deleteMany({});
    await prisma.topic_vocabularies.deleteMany({});
    await prisma.topics.deleteMany({});
    await prisma.lessons.deleteMany({});
    await prisma.courses.deleteMany({});
    await prisma.folders.deleteMany({});
    await prisma.users.deleteMany({});
}

async function createAuthenticatedUser(email: string, userDetails: any = {}) {
    const password = "Password123";
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await prisma.users.create({
        data: {
            id: userId,
            email,
            password_hash: passwordHash,
            display_name: "Statistics User",
            status: "active",
            role: "user",
            email_verified: true,
            ...userDetails
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

test("Statistics API System Tests", async (t) => {
    beforeEach(async () => {
        await clearDatabase();
    });

    after(async () => {
        await clearDatabase();
    });

    await t.test("GET /api/v1/statistics/me - 401 Unauthenticated", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/statistics/me",
        });

        assert.strictEqual(res.statusCode, 401);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "UNAUTHORIZED");
    });

    await t.test("GET /api/v1/statistics/me - 200 OK with default fallbacks (null fields in DB)", async () => {
        // User with null level, exp, streak
        const user = await createAuthenticatedUser("user@example.com", {
            level: null,
            exp: null,
            streak: null
        });

        const res = await app.inject({
            method: "GET",
            url: "/api/v1/statistics/me",
            headers: { Authorization: `Bearer ${user.token}` },
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.level, 1);
        assert.strictEqual(body.data.exp, 0);
        assert.strictEqual(body.data.streak, 0);
        assert.strictEqual(body.data.total_reviews, 0);
        assert.strictEqual(body.data.correct_reviews, 0);
        assert.strictEqual(body.data.accuracy_percent, null);
        assert.strictEqual(body.data.total_mastered, 0);
    });

    await t.test("GET /api/v1/statistics/me - 200 OK aggregates multiple reviews and mastered progress correctly", async () => {
        const user = await createAuthenticatedUser("user@example.com", {
            level: 5,
            exp: 2500,
            streak: 7
        });

        // 1. Seed legacy review histories (1 correct, 1 incorrect)
        await prisma.review_histories.createMany({
            data: [
                {
                    id: crypto.randomUUID(),
                    user_id: user.id,
                    correct: true,
                    reviewed_at: new Date()
                },
                {
                    id: crypto.randomUUID(),
                    user_id: user.id,
                    correct: false,
                    reviewed_at: new Date()
                }
            ]
        });

        // 2. Seed SRS review histories (1 correct - good, 1 incorrect - again)
        // Need to seed srs_card first due to foreign key
        const srsCardId1 = crypto.randomUUID();
        const srsCardId2 = crypto.randomUUID();
        await prisma.srs_cards.createMany({
            data: [
                {
                    id: srsCardId1,
                    user_id: user.id,
                    item_type: "vocabulary",
                    item_id: crypto.randomUUID(),
                    due_at: new Date(),
                },
                {
                    id: srsCardId2,
                    user_id: user.id,
                    item_type: "vocabulary",
                    item_id: crypto.randomUUID(),
                    due_at: new Date(),
                }
            ]
        });

        await prisma.srs_review_histories.createMany({
            data: [
                {
                    id: crypto.randomUUID(),
                    srs_card_id: srsCardId1,
                    user_id: user.id,
                    rating: "good",
                    interval_before_days: 1,
                    interval_after_days: 3,
                    ease_factor_before: 2.5,
                    ease_factor_after: 2.6,
                    reviewed_at: new Date()
                },
                {
                    id: crypto.randomUUID(),
                    srs_card_id: srsCardId2,
                    user_id: user.id,
                    rating: "again",
                    interval_before_days: 3,
                    interval_after_days: 0,
                    ease_factor_before: 2.6,
                    ease_factor_after: 2.5,
                    reviewed_at: new Date()
                }
            ]
        });

        // 3. Seed user daily stats (reviewed 10 words)
        await prisma.user_statistics_daily.create({
            data: {
                user_id: user.id,
                stat_date: new Date(),
                words_reviewed: 10,
                minutes_studied: 5,
                lessons_completed: 0,
                exp_earned: 100
            }
        });

        // 4. Seed learning progress (2 MASTERED vocabulary, 1 LEARNING)
        await prisma.learning_progress.createMany({
            data: [
                {
                    id: crypto.randomUUID(),
                    user_id: user.id,
                    vocabulary_id: null,
                    status: "MASTERED" as any
                },
                {
                    id: crypto.randomUUID(),
                    user_id: user.id,
                    vocabulary_id: null,
                    status: "MASTERED" as any
                },
                {
                    id: crypto.randomUUID(),
                    user_id: user.id,
                    vocabulary_id: null,
                    status: "LEARNING" as any
                }
            ]
        });

        // Query stats
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/statistics/me",
            headers: { Authorization: `Bearer ${user.token}` },
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.level, 5);
        assert.strictEqual(body.data.exp, 2500);
        assert.strictEqual(body.data.streak, 7);

        // Total reviews = legacy count (2) + srs count (2) + daily aggregate (10) = 14
        assert.strictEqual(body.data.total_reviews, 14);

        // Correct reviews = legacy correct (1) + srs correct (1) = 2
        assert.strictEqual(body.data.correct_reviews, 2);

        // Accuracy percent = 2 / 14 * 100 = 14.2857% -> 14.3%
        assert.strictEqual(body.data.accuracy_percent, 14.3);

        // Mastered count = 2
        assert.strictEqual(body.data.total_mastered, 2);
    });
});
