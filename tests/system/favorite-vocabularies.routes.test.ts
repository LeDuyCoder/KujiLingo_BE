import { test, beforeEach, after } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { signToken } from "../../src/common/utils/jwt.js";

async function clearDatabase() {
    await prisma.favorite_vocabularies.deleteMany({}).catch(() => {});
    await prisma.vocabulary_meanings.deleteMany({
        where: { vocabulary_id: { in: (await prisma.vocabularies.findMany({ select: { id: true } })).map(v => v.id) } }
    }).catch(() => {});
    await prisma.vocabularies.deleteMany({
        where: {
            kanji: { in: ["食べる", "飲む", "行く", "来る"] }
        }
    }).catch(() => {});
    await prisma.users.deleteMany({
        where: { email: { startsWith: "favtest_" } }
    }).catch(() => {});
}

test("Favorite Vocabularies API System Tests", async (t) => {
    let testUser: any;
    let userToken: string;

    beforeEach(async () => {
        await app.ready();
        await clearDatabase();

        // Create test user
        testUser = await prisma.users.create({
            data: {
                id: crypto.randomUUID(),
                email: `favtest_${Date.now()}_${Math.random()}@example.com`,
                password_hash: "hashed",
                display_name: "Favorite Test User",
                role: "USER",
                status: "active",
            },
        });

        userToken = signToken({ sub: testUser.id, role: testUser.role });
    });

    after(async () => {
        await clearDatabase();
        await prisma.$disconnect();
    });

    // =========================================================================
    // 1. GET /api/v1/favorite-vocabularies (List Favorites)
    // =========================================================================
    await t.test("GET /api/v1/favorite-vocabularies - 401 Unauthenticated", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/favorite-vocabularies",
        });

        assert.strictEqual(res.statusCode, 401);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "UNAUTHORIZED");
    });

    await t.test("GET /api/v1/favorite-vocabularies - empty list returns 200", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/favorite-vocabularies",
            headers: {
                authorization: `Bearer ${userToken}`,
            },
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.deepStrictEqual(body.data, []);
        assert.strictEqual(body.meta.total, 0);
    });

    await t.test("GET /api/v1/favorite-vocabularies - returns favorites with primary meaning in requested language", async () => {
        const vocabId = crypto.randomUUID();
        await prisma.vocabularies.create({
            data: {
                id: vocabId,
                kanji: "食べる",
                hiragana: "たべる",
                jlpt: "N5",
                vocabulary_meanings: {
                    createMany: {
                        data: [
                            { id: crypto.randomUUID(), language: "vi", meaning: "ăn", display_order: 1 },
                            { id: crypto.randomUUID(), language: "en", meaning: "to eat", display_order: 1 },
                        ],
                    },
                },
            },
        });

        await prisma.favorite_vocabularies.create({
            data: {
                user_id: testUser.id,
                vocabulary_id: vocabId,
            },
        });

        const res = await app.inject({
            method: "GET",
            url: "/api/v1/favorite-vocabularies",
            headers: {
                authorization: `Bearer ${userToken}`,
                "accept-language": "vi",
            },
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.length, 1);
        assert.strictEqual(body.data[0].vocabulary_id, vocabId);
        assert.strictEqual(body.data[0].kanji, "食べる");
        assert.strictEqual(body.data[0].hiragana, "たべる");
        assert.strictEqual(body.data[0].meaning, "ăn");
        assert.strictEqual(body.data[0].jlpt, "N5");
    });

    await t.test("GET /api/v1/favorite-vocabularies - 400 on invalid limit", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/favorite-vocabularies?limit=500",
            headers: {
                authorization: `Bearer ${userToken}`,
            },
        });

        assert.strictEqual(res.statusCode, 400);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "VALIDATION_ERROR");
    });

    // =========================================================================
    // 2. POST /api/v1/favorite-vocabularies (Add Favorite)
    // =========================================================================
    await t.test("POST /api/v1/favorite-vocabularies - 401 Unauthenticated", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/api/v1/favorite-vocabularies",
            payload: { vocabulary_id: crypto.randomUUID() },
        });

        assert.strictEqual(res.statusCode, 401);
    });

    await t.test("POST /api/v1/favorite-vocabularies - 422 INVALID_VOCABULARY_REFERENCE when vocab does not exist", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/api/v1/favorite-vocabularies",
            headers: {
                authorization: `Bearer ${userToken}`,
            },
            payload: { vocabulary_id: crypto.randomUUID() },
        });

        assert.strictEqual(res.statusCode, 422);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "INVALID_VOCABULARY_REFERENCE");
    });

    await t.test("POST /api/v1/favorite-vocabularies - success 201 Created", async () => {
        const vocabId = crypto.randomUUID();
        await prisma.vocabularies.create({
            data: { id: vocabId, kanji: "飲む", hiragana: "のむ" },
        });

        const res = await app.inject({
            method: "POST",
            url: "/api/v1/favorite-vocabularies",
            headers: {
                authorization: `Bearer ${userToken}`,
            },
            payload: { vocabulary_id: vocabId },
        });

        assert.strictEqual(res.statusCode, 201);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.message, "Added to favorites.");
    });

    await t.test("POST /api/v1/favorite-vocabularies - 409 ALREADY_FAVORITED on duplicate", async () => {
        const vocabId = crypto.randomUUID();
        await prisma.vocabularies.create({
            data: { id: vocabId, kanji: "行く", hiragana: "いく" },
        });

        await prisma.favorite_vocabularies.create({
            data: { user_id: testUser.id, vocabulary_id: vocabId },
        });

        const res = await app.inject({
            method: "POST",
            url: "/api/v1/favorite-vocabularies",
            headers: {
                authorization: `Bearer ${userToken}`,
            },
            payload: { vocabulary_id: vocabId },
        });

        assert.strictEqual(res.statusCode, 409);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "ALREADY_FAVORITED");
    });

    // =========================================================================
    // 3. DELETE /api/v1/favorite-vocabularies/:vocabularyId (Remove Favorite)
    // =========================================================================
    await t.test("DELETE /api/v1/favorite-vocabularies/:vocabularyId - 401 Unauthenticated", async () => {
        const res = await app.inject({
            method: "DELETE",
            url: `/api/v1/favorite-vocabularies/${crypto.randomUUID()}`,
        });

        assert.strictEqual(res.statusCode, 401);
    });

    await t.test("DELETE /api/v1/favorite-vocabularies/:vocabularyId - 400 on malformed UUID", async () => {
        const res = await app.inject({
            method: "DELETE",
            url: "/api/v1/favorite-vocabularies/invalid-uuid-string",
            headers: {
                authorization: `Bearer ${userToken}`,
            },
        });

        assert.strictEqual(res.statusCode, 400);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.error.code, "VALIDATION_ERROR");
    });

    await t.test("DELETE /api/v1/favorite-vocabularies/:vocabularyId - 200 OK on existing favorite", async () => {
        const vocabId = crypto.randomUUID();
        await prisma.vocabularies.create({
            data: { id: vocabId, kanji: "来る", hiragana: "くる" },
        });

        await prisma.favorite_vocabularies.create({
            data: { user_id: testUser.id, vocabulary_id: vocabId },
        });

        const res = await app.inject({
            method: "DELETE",
            url: `/api/v1/favorite-vocabularies/${vocabId}`,
            headers: {
                authorization: `Bearer ${userToken}`,
            },
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.message, "Removed from favorites.");
    });

    await t.test("DELETE /api/v1/favorite-vocabularies/:vocabularyId - 200 OK on non-existing favorite (idempotent)", async () => {
        const res = await app.inject({
            method: "DELETE",
            url: `/api/v1/favorite-vocabularies/${crypto.randomUUID()}`,
            headers: {
                authorization: `Bearer ${userToken}`,
            },
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.message, "Removed from favorites.");
    });
});
