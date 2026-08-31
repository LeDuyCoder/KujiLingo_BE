import { test, beforeEach, after } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";

async function clearDatabase() {
    await prisma.pvp_match_histories.deleteMany({});
    await prisma.user_pvp_statistics.deleteMany({});
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

async function createAuthenticatedUser(email: string, displayName: string = "PVP Player") {
    const password = "Password123";
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await prisma.users.create({
        data: {
            id: userId,
            email,
            password_hash: passwordHash,
            display_name: displayName,
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

test("PVP REST API System Tests", async (t) => {
    beforeEach(async () => {
        await clearDatabase();
    });

    after(async () => {
        await clearDatabase();
    });

    // 1. Get My Statistics
    await t.test("GET /api/v1/pvp/statistics - 401 Unauthenticated", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/pvp/statistics",
        });

        assert.strictEqual(res.statusCode, 401);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "UNAUTHORIZED");
    });

    await t.test("GET /api/v1/pvp/statistics - 200 OK returns zeroed defaults for new user", async () => {
        const user = await createAuthenticatedUser("new_player@example.com", "New Player");

        const res = await app.inject({
            method: "GET",
            url: "/api/v1/pvp/statistics",
            headers: { Authorization: `Bearer ${user.token}` },
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.deepStrictEqual(body.data, {
            total_matches: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            win_rate: null,
            rating: 1200,
            highest_rating: 1200,
        });
    });

    // 2. Get Match History
    await t.test("GET /api/v1/pvp/history - 400 Bad Request on invalid result query", async () => {
        const user = await createAuthenticatedUser("player1@example.com");

        const res = await app.inject({
            method: "GET",
            url: "/api/v1/pvp/history?result=INVALID_RESULT",
            headers: { Authorization: `Bearer ${user.token}` },
        });

        assert.strictEqual(res.statusCode, 400);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "VALIDATION_ERROR");
    });

    await t.test("GET /api/v1/pvp/history - 400 Bad Request on limit out of range", async () => {
        const user = await createAuthenticatedUser("player1@example.com");

        const res = await app.inject({
            method: "GET",
            url: "/api/v1/pvp/history?limit=100",
            headers: { Authorization: `Bearer ${user.token}` },
        });

        assert.strictEqual(res.statusCode, 400);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "VALIDATION_ERROR");
    });

    // 3. Record Match Result (Internal API)
    await t.test("POST /api/v1/pvp/matches - 401 Unauthorized on invalid X-Internal-Key", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/api/v1/pvp/matches",
            headers: { "X-Internal-Key": "wrong_key" },
            payload: {
                user_id: crypto.randomUUID(),
                opponent_id: crypto.randomUUID(),
                played_at: new Date().toISOString(),
            },
        });

        assert.strictEqual(res.statusCode, 401);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "INVALID_INTERNAL_KEY");
    });

    await t.test("POST /api/v1/pvp/matches - 422 Unprocessable Entity when user does not exist", async () => {
        const user1 = await createAuthenticatedUser("user1@example.com");
        const internalKey = process.env.PVP_INTERNAL_KEY || "kujilingo_pvp_internal_secret_key_2026";

        const res = await app.inject({
            method: "POST",
            url: "/api/v1/pvp/matches",
            headers: { "X-Internal-Key": internalKey },
            payload: {
                user_id: user1.id,
                opponent_id: crypto.randomUUID(),
                winner_id: user1.id,
                played_at: new Date().toISOString(),
            },
        });

        assert.strictEqual(res.statusCode, 422);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "USER_NOT_FOUND");
    });

    await t.test("POST /api/v1/pvp/matches & GET /api/v1/pvp/statistics - Full match recording & stats flow", async () => {
        const user1 = await createAuthenticatedUser("player_a@example.com", "Player A");
        const user2 = await createAuthenticatedUser("player_b@example.com", "Player B");
        const internalKey = process.env.PVP_INTERNAL_KEY || "kujilingo_pvp_internal_secret_key_2026";

        const matchPayload = {
            user_id: user1.id,
            opponent_id: user2.id,
            winner_id: user1.id,
            user_score: 8,
            opponent_score: 5,
            rating_change_user: 15,
            rating_change_opponent: -15,
            played_at: new Date().toISOString(),
        };

        const recordRes = await app.inject({
            method: "POST",
            url: "/api/v1/pvp/matches",
            headers: { "X-Internal-Key": internalKey },
            payload: matchPayload,
        });

        assert.strictEqual(recordRes.statusCode, 201);
        const recordBody = JSON.parse(recordRes.body);
        assert.strictEqual(recordBody.success, true);
        assert.ok(recordBody.data.match_id);

        // Verify Player A stats
        const statsResA = await app.inject({
            method: "GET",
            url: "/api/v1/pvp/statistics",
            headers: { Authorization: `Bearer ${user1.token}` },
        });

        assert.strictEqual(statsResA.statusCode, 200);
        const statsBodyA = JSON.parse(statsResA.body);
        assert.strictEqual(statsBodyA.data.total_matches, 1);
        assert.strictEqual(statsBodyA.data.wins, 1);
        assert.strictEqual(statsBodyA.data.losses, 0);
        assert.strictEqual(statsBodyA.data.win_rate, 100.0);
        assert.strictEqual(statsBodyA.data.rating, 1215);

        // Verify Player B stats
        const statsResB = await app.inject({
            method: "GET",
            url: "/api/v1/pvp/statistics",
            headers: { Authorization: `Bearer ${user2.token}` },
        });

        assert.strictEqual(statsResB.statusCode, 200);
        const statsBodyB = JSON.parse(statsResB.body);
        assert.strictEqual(statsBodyB.data.total_matches, 1);
        assert.strictEqual(statsBodyB.data.wins, 0);
        assert.strictEqual(statsBodyB.data.losses, 1);
        assert.strictEqual(statsBodyB.data.win_rate, 0.0);
        assert.strictEqual(statsBodyB.data.rating, 1185);

        // Verify Match History for Player A
        const historyResA = await app.inject({
            method: "GET",
            url: "/api/v1/pvp/history?page=1&limit=10",
            headers: { Authorization: `Bearer ${user1.token}` },
        });

        assert.strictEqual(historyResA.statusCode, 200);
        const historyBodyA = JSON.parse(historyResA.body);
        assert.strictEqual(historyBodyA.data.length, 1);
        assert.strictEqual(historyBodyA.data[0].opponent_name, "Player B");
        assert.strictEqual(historyBodyA.data[0].result, "WIN");
        assert.strictEqual(historyBodyA.data[0].score.player, 8);
        assert.strictEqual(historyBodyA.data[0].score.opponent, 5);

        // Verify Match History for Player B (inverted)
        const historyResB = await app.inject({
            method: "GET",
            url: "/api/v1/pvp/history?page=1&limit=10",
            headers: { Authorization: `Bearer ${user2.token}` },
        });

        assert.strictEqual(historyResB.statusCode, 200);
        const historyBodyB = JSON.parse(historyResB.body);
        assert.strictEqual(historyBodyB.data.length, 1);
        assert.strictEqual(historyBodyB.data[0].opponent_name, "Player A");
        assert.strictEqual(historyBodyB.data[0].result, "LOSS");
        assert.strictEqual(historyBodyB.data[0].score.player, 5);
        assert.strictEqual(historyBodyB.data[0].score.opponent, 8);
    });

    // 4. Get PVP Leaderboard
    await t.test("GET /api/v1/pvp/leaderboard - 200 OK returns leaderboard and caller rank", async () => {
        const user1 = await createAuthenticatedUser("top1@example.com", "Pro Player");
        const user2 = await createAuthenticatedUser("top2@example.com", "Rookie Player");
        const internalKey = process.env.PVP_INTERNAL_KEY || "kujilingo_pvp_internal_secret_key_2026";

        // Record a match so user1 becomes rank 1
        await app.inject({
            method: "POST",
            url: "/api/v1/pvp/matches",
            headers: { "X-Internal-Key": internalKey },
            payload: {
                user_id: user1.id,
                opponent_id: user2.id,
                winner_id: user1.id,
                rating_change_user: 50,
                rating_change_opponent: -50,
                played_at: new Date().toISOString(),
            },
        });

        const lbRes = await app.inject({
            method: "GET",
            url: "/api/v1/pvp/leaderboard?limit=50",
            headers: { Authorization: `Bearer ${user1.token}` },
        });

        assert.strictEqual(lbRes.statusCode, 200);
        const lbBody = JSON.parse(lbRes.body);
        assert.strictEqual(lbBody.success, true);
        assert.strictEqual(lbBody.data.entries.length, 2);
        assert.strictEqual(lbBody.data.entries[0].user_id, user1.id);
        assert.strictEqual(lbBody.data.entries[0].rank, 1);
        assert.strictEqual(lbBody.data.entries[0].rating, 1250);
        assert.strictEqual(lbBody.data.entries[1].user_id, user2.id);
        assert.strictEqual(lbBody.data.entries[1].rank, 2);
        assert.strictEqual(lbBody.data.entries[1].rating, 1150);

        assert.deepStrictEqual(lbBody.data.current_user, {
            rank: 1,
            rating: 1250,
            total_matches: 1,
        });
    });
});
