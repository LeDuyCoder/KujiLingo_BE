import { test, beforeEach, after } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";

async function clearDatabase() {
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

async function createAuthenticatedUser(email: string, targetLevel: string = "N5") {
    const password = "Password123";
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await prisma.users.create({
        data: {
            id: userId,
            email,
            password_hash: passwordHash,
            display_name: "Dashboard User",
            status: "active",
            role: "user",
            email_verified: true,
            jlpt_target_level: targetLevel as any,
            streak: 5,
            longest_streak: 10,
            learning_goal_minutes: 20
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

test("Dashboard API - Database Integration Tests", async (t) => {
    beforeEach(async () => {
        await clearDatabase();
    });

    after(async () => {
        await clearDatabase();
    });

    await t.test("GET /dashboard - unauthorized 401", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/dashboard",
        });

        assert.strictEqual(res.statusCode, 401);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "UNAUTHORIZED");
    });

    await t.test("GET /dashboard - success with recommendations & daily stats", async () => {
        const user = await createAuthenticatedUser("user@example.com", "N4");

        // 1. Mock daily study stats for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await prisma.user_statistics_daily.create({
            data: {
                user_id: user.id,
                stat_date: today,
                minutes_studied: 8, // Study 8 minutes out of 20 goal
                lessons_completed: 1,
                exp_earned: 50
            }
        });

        // 2. Create courses & lessons for N4 level recommendation
        const courseId = crypto.randomUUID();
        await prisma.courses.create({
            data: {
                id: courseId,
                title: "JLPT N4 Complete Course",
                order_no: 1
            }
        });

        const lessonId = crypto.randomUUID();
        await prisma.lessons.create({
            data: {
                id: lessonId,
                course_id: courseId,
                title: "Basic Verbs",
                order_no: 1
            }
        });

        const res = await app.inject({
            method: "GET",
            url: "/api/v1/dashboard",
            headers: { Authorization: `Bearer ${user.token}` }
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        
        // Assert streak
        assert.strictEqual(body.data.streak.current_streak_days, 5);
        assert.strictEqual(body.data.streak.longest_streak_days, 10);
        assert.strictEqual(body.data.streak.is_at_risk, false);

        // Assert progress percent (8 / 20 * 100 = 40%)
        assert.strictEqual(body.data.daily_goal_progress.minutes_studied_today, 8);
        assert.strictEqual(body.data.daily_goal_progress.goal_minutes, 20);
        assert.strictEqual(body.data.daily_goal_progress.percent, 40);

        // Assert continue learning recommendation
        assert.ok(body.data.continue_learning);
        assert.strictEqual(body.data.continue_learning.lesson_id, lessonId);
        assert.strictEqual(body.data.continue_learning.lesson_title, "Basic Verbs");
        assert.strictEqual(body.data.continue_learning.course_title, "JLPT N4 Complete Course");
        assert.strictEqual(body.data.continue_learning.reason, "recommended");
    });

    await t.test("GET /dashboard - percent capped at 100", async () => {
        const user = await createAuthenticatedUser("user@example.com", "N5");

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await prisma.user_statistics_daily.create({
            data: {
                user_id: user.id,
                stat_date: today,
                minutes_studied: 35, // 35 minutes studied with 20 minutes goal -> 175%
                lessons_completed: 2,
                exp_earned: 120
            }
        });

        const res = await app.inject({
            method: "GET",
            url: "/api/v1/dashboard",
            headers: { Authorization: `Bearer ${user.token}` }
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.daily_goal_progress.minutes_studied_today, 35);
        assert.strictEqual(body.data.daily_goal_progress.percent, 100); // capped at 100
    });
});
