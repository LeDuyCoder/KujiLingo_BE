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
    await prisma.folder_system_vocabularies.deleteMany({});
    await prisma.folder_user_vocabularies.deleteMany({});
    await prisma.example_sentences.deleteMany({});
    await prisma.vocabulary_meanings.deleteMany({});
    await prisma.kanji_vocabularies.deleteMany({});
    await prisma.topic_vocabularies.deleteMany({});
    await prisma.vocabularies.deleteMany({});
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
    await prisma.topics.deleteMany({});
    await prisma.lessons.deleteMany({});
    await prisma.courses.deleteMany({});
    await prisma.folders.deleteMany({});
    await prisma.users.deleteMany({});
}

async function createAuthenticatedUser(email: string, role: string = "user") {
    const password = "Password123";
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await prisma.users.create({
        data: {
            id: userId,
            email,
            password_hash: passwordHash,
            display_name: role === "admin" ? "Admin User" : "Regular User",
            status: "active",
            role,
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

test("Platform Vocabulary API System Tests", async (t) => {
    beforeEach(async () => {
        await clearDatabase();
    });

    after(async () => {
        await clearDatabase();
    });

    await t.test("GET /api/v1/vocabularies - returns public list", async () => {
        // Seed some vocabularies
        const vocabId = crypto.randomUUID();
        await prisma.vocabularies.create({
            data: {
                id: vocabId,
                kanji: "食べる",
                hiragana: "たべる",
                romaji: "taberu",
                jlpt: "N5",
                frequency: 1,
            }
        });

        await prisma.vocabulary_meanings.create({
            data: {
                id: crypto.randomUUID(),
                vocabulary_id: vocabId,
                language: "vi",
                meaning: "ăn",
                display_order: 1
            }
        });

        const res = await app.inject({
            method: "GET",
            url: "/api/v1/vocabularies"
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.length, 1);
        assert.strictEqual(body.data[0].word_jp, "食べる");
        assert.strictEqual(body.data[0].meaning_vi, "ăn");
        assert.strictEqual(body.data[0].is_favorited, false);
    });

    await t.test("GET /api/v1/vocabularies/:id - returns detail & personalization if auth", async () => {
        const user = await createAuthenticatedUser("user@example.com");

        const vocabId = crypto.randomUUID();
        await prisma.vocabularies.create({
            data: {
                id: vocabId,
                kanji: "飲む",
                hiragana: "のむ",
                romaji: "nomu",
                jlpt: "N5",
                frequency: 2,
            }
        });

        await prisma.vocabulary_meanings.create({
            data: {
                id: crypto.randomUUID(),
                vocabulary_id: vocabId,
                language: "vi",
                meaning: "uống",
                display_order: 1
            }
        });

        // Set as favorite
        await prisma.favorite_vocabularies.create({
            data: {
                user_id: user.id,
                vocabulary_id: vocabId
            }
        });

        const res = await app.inject({
            method: "GET",
            url: `/api/v1/vocabularies/${vocabId}`,
            headers: { Authorization: `Bearer ${user.token}` }
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.word_jp, "飲む");
        assert.strictEqual(body.data.is_favorited, true);
    });

    await t.test("GET /api/v1/vocabularies/:id - 404 for soft deleted", async () => {
        const vocabId = crypto.randomUUID();
        await prisma.vocabularies.create({
            data: {
                id: vocabId,
                kanji: "飲む",
                hiragana: "のむ",
                romaji: "nomu",
                jlpt: "N5",
                deleted_at: new Date() // Soft deleted!
            }
        });

        const res = await app.inject({
            method: "GET",
            url: `/api/v1/vocabularies/${vocabId}`
        });

        assert.strictEqual(res.statusCode, 404);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "VOCABULARY_NOT_FOUND");
    });

    await t.test("POST /api/v1/admin/vocabularies - 201 created by admin", async () => {
        const admin = await createAuthenticatedUser("admin@example.com", "admin");

        const res = await app.inject({
            method: "POST",
            url: "/api/v1/admin/vocabularies",
            headers: { Authorization: `Bearer ${admin.token}` },
            payload: {
                word_jp: "勉強する",
                reading_hiragana: "べんきょうする",
                meaning_vi: "học tập",
                jlpt_level: "N4",
            }
        });

        assert.strictEqual(res.statusCode, 201);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.word_jp, "勉強する");
        assert.ok(body.data.id);

        // Verify audit log exists
        const audit = await prisma.admin_audit_logs.findFirst({
            where: { entity_id: body.data.id }
        });
        assert.ok(audit);
        assert.strictEqual(audit.action, "vocabulary.created");
    });

    await t.test("POST /api/v1/admin/vocabularies - 403 Forbidden for non-admin", async () => {
        const user = await createAuthenticatedUser("user@example.com", "user");

        const res = await app.inject({
            method: "POST",
            url: "/api/v1/admin/vocabularies",
            headers: { Authorization: `Bearer ${user.token}` },
            payload: {
                word_jp: "勉強する",
                reading_hiragana: "べんきょうする",
                meaning_vi: "học tập",
                jlpt_level: "N4",
            }
        });

        assert.strictEqual(res.statusCode, 403);
    });

    await t.test("PUT /api/v1/admin/vocabularies/:id - 200 OK updates vocabulary", async () => {
        const admin = await createAuthenticatedUser("admin@example.com", "admin");

        const vocabId = crypto.randomUUID();
        await prisma.vocabularies.create({
            data: {
                id: vocabId,
                kanji: "走る",
                hiragana: "はしる",
                jlpt: "N4"
            }
        });

        await prisma.vocabulary_meanings.create({
            data: {
                id: crypto.randomUUID(),
                vocabulary_id: vocabId,
                language: "vi",
                meaning: "chạy",
                display_order: 1
            }
        });

        const res = await app.inject({
            method: "PUT",
            url: `/api/v1/admin/vocabularies/${vocabId}`,
            headers: { Authorization: `Bearer ${admin.token}` },
            payload: {
                meaning_vi: "chạy bộ",
                reading_romaji: "hashiru"
            }
        });

        assert.strictEqual(res.statusCode, 200);

        // Verify in DB
        const updatedMeanings = await prisma.vocabulary_meanings.findMany({
            where: { vocabulary_id: vocabId, language: "vi" }
        });
        assert.strictEqual(updatedMeanings[0].meaning, "chạy bộ");
    });

    await t.test("DELETE /api/v1/admin/vocabularies/:id - 200 OK soft deletes vocabulary", async () => {
        const admin = await createAuthenticatedUser("admin@example.com", "admin");

        const vocabId = crypto.randomUUID();
        await prisma.vocabularies.create({
            data: {
                id: vocabId,
                kanji: "歩く",
                hiragana: "あるく",
                jlpt: "N5"
            }
        });

        const res = await app.inject({
            method: "DELETE",
            url: `/api/v1/admin/vocabularies/${vocabId}`,
            headers: { Authorization: `Bearer ${admin.token}` }
        });

        assert.strictEqual(res.statusCode, 200);

        // Verify soft-deleted in DB
        const dbEntry = await prisma.vocabularies.findUnique({
            where: { id: vocabId }
        });
        assert.ok(dbEntry?.deleted_at);
    });
});
