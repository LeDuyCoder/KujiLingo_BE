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
    await prisma.folder_user_vocabularies.deleteMany({});
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

async function createAuthenticatedUser(email: string) {
    const password = "Password123";
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await prisma.users.create({
        data: {
            id: userId,
            email,
            password_hash: passwordHash,
            display_name: "Vocabulary User",
            status: "active",
            role: "user",
            email_verified: true,
        },
    });

    const loginRes = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password },
    });

    const body = JSON.parse(loginRes.body);
    return {
        id: userId,
        token: body.data.access_token,
    };
}

test("User Vocabulary API System Tests", async (t) => {
    beforeEach(async () => {
        await clearDatabase();
    });

    after(async () => {
        await clearDatabase();
    });

    await t.test("GET /api/v1/user-vocabularies - 401 Unauthenticated", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/user-vocabularies",
        });

        assert.strictEqual(res.statusCode, 401);
    });

    await t.test("POST /api/v1/user-vocabularies - 201 Created and GET returns entries", async () => {
        const user = await createAuthenticatedUser("user@example.com");

        // 1. Create a vocabulary entry
        const createRes = await app.inject({
            method: "POST",
            url: "/api/v1/user-vocabularies",
            headers: { Authorization: `Bearer ${user.token}` },
            payload: {
                kanji: "日本語",
                hiragana: "にほんご",
                romaji: "nihongo",
                meaning: "Japanese language",
                note: "Study everyday"
            }
        });

        assert.strictEqual(createRes.statusCode, 201);
        const createBody = JSON.parse(createRes.body);
        assert.strictEqual(createBody.success, true);
        assert.strictEqual(createBody.data.kanji, "日本語");
        assert.strictEqual(createBody.data.meaning, "Japanese language");
        assert.ok(createBody.data.id);

        const vocabId = createBody.data.id;

        // 2. Fetch vocabulary list
        const listRes = await app.inject({
            method: "GET",
            url: "/api/v1/user-vocabularies",
            headers: { Authorization: `Bearer ${user.token}` }
        });

        assert.strictEqual(listRes.statusCode, 200);
        const listBody = JSON.parse(listRes.body);
        assert.strictEqual(listBody.success, true);
        assert.strictEqual(listBody.data.length, 1);
        assert.strictEqual(listBody.data[0].id, vocabId);
        assert.strictEqual(listBody.data[0].kanji, "日本語");
        assert.strictEqual(listBody.data[0].hiragana, "にほんご");
        assert.strictEqual(listBody.data[0].romaji, "nihongo");
        assert.strictEqual(listBody.data[0].meaning, "Japanese language");
        assert.strictEqual(listBody.data[0].note, "Study everyday");
    });

    await t.test("GET /api/v1/user-vocabularies - supports search filter and pagination", async () => {
        const user = await createAuthenticatedUser("user@example.com");

        // Seed 3 entries
        await prisma.user_vocabularies.createMany({
            data: [
                {
                    id: crypto.randomUUID(),
                    user_id: user.id,
                    kanji: "食べる",
                    hiragana: "たべる",
                    romaji: "taberu",
                    meaning: "to eat",
                    created_at: new Date(Date.now() - 3000)
                },
                {
                    id: crypto.randomUUID(),
                    user_id: user.id,
                    kanji: "飲む",
                    hiragana: "のむ",
                    romaji: "nomu",
                    meaning: "to drink",
                    created_at: new Date(Date.now() - 2000)
                },
                {
                    id: crypto.randomUUID(),
                    user_id: user.id,
                    kanji: "日本",
                    hiragana: "にほん",
                    romaji: "nihon",
                    meaning: "Japan",
                    created_at: new Date(Date.now() - 1000)
                }
            ]
        });

        // Test search matching "to" (should return eat and drink)
        const searchRes = await app.inject({
            method: "GET",
            url: "/api/v1/user-vocabularies?search=to",
            headers: { Authorization: `Bearer ${user.token}` }
        });

        assert.strictEqual(searchRes.statusCode, 200);
        const searchBody = JSON.parse(searchRes.body);
        assert.strictEqual(searchBody.data.length, 2);
        assert.strictEqual(searchBody.meta.total, 2);

        // Test pagination
        const pageRes = await app.inject({
            method: "GET",
            url: "/api/v1/user-vocabularies?page=2&limit=2",
            headers: { Authorization: `Bearer ${user.token}` }
        });

        assert.strictEqual(pageRes.statusCode, 200);
        const pageBody = JSON.parse(pageRes.body);
        // Page 2 with limit 2 of 3 total entries should return 1 entry (the oldest one: 食べる)
        assert.strictEqual(pageBody.data.length, 1);
        assert.strictEqual(pageBody.data[0].kanji, "食べる");
        assert.strictEqual(pageBody.meta.total_pages, 2);
    });

    await t.test("PUT /api/v1/user-vocabularies/:id - 200 OK updates owned entry", async () => {
        const user = await createAuthenticatedUser("user@example.com");

        const entry = await prisma.user_vocabularies.create({
            data: {
                id: crypto.randomUUID(),
                user_id: user.id,
                kanji: "猫",
                hiragana: "ねこ",
                meaning: "cat"
            }
        });

        const updateRes = await app.inject({
            method: "PUT",
            url: `/api/v1/user-vocabularies/${entry.id}`,
            headers: { Authorization: `Bearer ${user.token}` },
            payload: {
                meaning: "kitty/cat",
                note: "very cute"
            }
        });

        assert.strictEqual(updateRes.statusCode, 200);
        const updateBody = JSON.parse(updateRes.body);
        assert.strictEqual(updateBody.success, true);
        assert.strictEqual(updateBody.data.meaning, "kitty/cat");
        assert.strictEqual(updateBody.data.note, "very cute");

        // Verify in DB
        const dbEntry = await prisma.user_vocabularies.findUnique({
            where: { id: entry.id }
        });
        assert.strictEqual(dbEntry?.meaning, "kitty/cat");
        assert.strictEqual(dbEntry?.note, "very cute");
    });

    await t.test("PUT /api/v1/user-vocabularies/:id - 404 for unowned entry", async () => {
        const user1 = await createAuthenticatedUser("user1@example.com");
        const user2 = await createAuthenticatedUser("user2@example.com");

        const entryOfUser1 = await prisma.user_vocabularies.create({
            data: {
                id: crypto.randomUUID(),
                user_id: user1.id,
                kanji: "犬",
                hiragana: "いぬ",
                meaning: "dog"
            }
        });

        // User 2 tries to update User 1's entry
        const res = await app.inject({
            method: "PUT",
            url: `/api/v1/user-vocabularies/${entryOfUser1.id}`,
            headers: { Authorization: `Bearer ${user2.token}` },
            payload: {
                meaning: "puppy"
            }
        });

        assert.strictEqual(res.statusCode, 404);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "USER_VOCABULARY_NOT_FOUND");
    });

    await t.test("DELETE /api/v1/user-vocabularies/:id - 200 OK hard-deletes and removes folder join rows", async () => {
        const user = await createAuthenticatedUser("user@example.com");

        const entry = await prisma.user_vocabularies.create({
            data: {
                id: crypto.randomUUID(),
                user_id: user.id,
                kanji: "鳥",
                meaning: "bird"
            }
        });

        // Create folder and link entry
        const folder = await prisma.folders.create({
            data: {
                id: crypto.randomUUID(),
                user_id: user.id,
                name: "My Folder"
            }
        });

        await prisma.folder_user_vocabularies.create({
            data: {
                folder_id: folder.id,
                user_vocabulary_id: entry.id
            }
        });

        // Delete entry
        const deleteRes = await app.inject({
            method: "DELETE",
            url: `/api/v1/user-vocabularies/${entry.id}`,
            headers: { Authorization: `Bearer ${user.token}` }
        });

        assert.strictEqual(deleteRes.statusCode, 200);

        // Verify user_vocabularies is gone
        const dbEntry = await prisma.user_vocabularies.findUnique({
            where: { id: entry.id }
        });
        assert.strictEqual(dbEntry, null);

        // Verify folder join table row is gone
        const dbJoinCount = await prisma.folder_user_vocabularies.count({
            where: { user_vocabulary_id: entry.id }
        });
        assert.strictEqual(dbJoinCount, 0);

        // Verify folder still exists
        const dbFolder = await prisma.folders.findUnique({
            where: { id: folder.id }
        });
        assert.ok(dbFolder);
    });
});
