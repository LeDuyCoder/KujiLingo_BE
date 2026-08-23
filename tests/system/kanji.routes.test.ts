import { test, before, after } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { signToken } from "../../src/common/utils/jwt.js";

async function clearDatabase() {
    await prisma.kanji_vocabularies.deleteMany({});
    await prisma.kanjis.deleteMany({});
    await prisma.admin_audit_logs.deleteMany({});
    await prisma.users.deleteMany({
        where: { email: { in: ["admin_kanji_sys@example.com", "user_kanji_sys@example.com"] } },
    });
}

test("Kanji API System Tests", async (t) => {
    let adminToken: string;
    let userToken: string;
    let adminUserId: string;
    let regularUserId: string;
    let testKanjiId: string;

    async function setupTestData() {
        await clearDatabase();

        // Create Admin user
        adminUserId = crypto.randomUUID();
        await prisma.users.create({
            data: {
                id: adminUserId,
                email: "admin_kanji_sys@example.com",
                display_name: "Admin Kanji Test",
                role: "admin",
                status: "active",
                email_verified: true,
            },
        });
        adminToken = signToken({ sub: adminUserId, role: "admin" });

        // Create Regular user
        regularUserId = crypto.randomUUID();
        await prisma.users.create({
            data: {
                id: regularUserId,
                email: "user_kanji_sys@example.com",
                display_name: "User Kanji Test",
                role: "user",
                status: "active",
                email_verified: true,
            },
        });
        userToken = signToken({ sub: regularUserId, role: "user" });

        // Insert sample kanji
        testKanjiId = crypto.randomUUID();
        await prisma.kanjis.create({
            data: {
                id: testKanjiId,
                kanji: "日",
                meaning: "Mặt trời, ngày",
                onyomi: "ニチ、ジツ",
                kunyomi: "ひ、か",
                stroke_count: 4,
                jlpt: "N5",
                radical: "日",
                stroke_order_image_url: "https://example.com/日.gif",
                examples: [{ word_jp: "日本", reading: "にほん", meaning_vi: "Nhật Bản" }],
            },
        });
    }

    before(async () => {
        await app.ready();
    });

    after(async () => {
        await clearDatabase();
    });

    // =============================================
    // GET /api/v1/kanji
    // =============================================

    await t.test("GET /api/v1/kanji - 200 OK return list with pagination meta", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/kanji?page=1&limit=10",
        });

        assert.strictEqual(response.statusCode, 200);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, true);
        assert.ok(Array.isArray(payload.data));
        assert.strictEqual(payload.data.length, 1);
        assert.strictEqual(payload.data[0].character, "日");
        assert.strictEqual(payload.data[0].jlpt_level, "N5");
        assert.strictEqual(typeof payload.data[0].is_saved, "boolean");
        assert.ok(payload.meta);
        assert.strictEqual(payload.meta.page, 1);
        assert.strictEqual(payload.meta.limit, 10);
        assert.strictEqual(payload.meta.total, 1);
    });

    await t.test("GET /api/v1/kanji - 200 OK filtered by jlpt_level=N5", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/kanji?jlpt_level=N5",
        });

        assert.strictEqual(response.statusCode, 200);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, true);
        assert.strictEqual(payload.data.length, 1);
        assert.strictEqual(payload.data[0].jlpt_level, "N5");
    });

    await t.test("GET /api/v1/kanji - 200 OK filtered by jlpt_level=N4 returns empty", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/kanji?jlpt_level=N4",
        });

        assert.strictEqual(response.statusCode, 200);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, true);
        assert.strictEqual(payload.data.length, 0);
        assert.strictEqual(payload.meta.total, 0);
    });

    await t.test("GET /api/v1/kanji - 200 OK filtered by search term", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/kanji?search=%E6%97%A5", // "日" URL-encoded
        });

        assert.strictEqual(response.statusCode, 200);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, true);
        assert.strictEqual(payload.data.length, 1);
    });

    await t.test("GET /api/v1/kanji - 200 OK filtered by stroke_count range", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/kanji?min_strokes=1&max_strokes=5",
        });

        assert.strictEqual(response.statusCode, 200);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, true);
        assert.strictEqual(payload.data.length, 1);
    });

    await t.test("GET /api/v1/kanji - 400 Bad Request on invalid jlpt_level", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/kanji?jlpt_level=INVALID",
        });

        assert.strictEqual(response.statusCode, 400);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, false);
        assert.strictEqual(payload.error.code, "VALIDATION_ERROR");
    });

    await t.test("GET /api/v1/kanji - 422 INVALID_STROKE_RANGE when min > max", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/kanji?min_strokes=10&max_strokes=5",
        });

        assert.strictEqual(response.statusCode, 422);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, false);
        assert.strictEqual(payload.error.code, "INVALID_STROKE_RANGE");
    });

    // =============================================
    // GET /api/v1/kanji/:id
    // =============================================

    await t.test("GET /api/v1/kanji/:id - 200 OK return detail", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "GET",
            url: `/api/v1/kanji/${testKanjiId}`,
        });

        assert.strictEqual(response.statusCode, 200);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, true);
        assert.strictEqual(payload.data.id, testKanjiId);
        assert.strictEqual(payload.data.character, "日");
        assert.strictEqual(payload.data.radical, "日");
        assert.ok(Array.isArray(payload.data.examples));
        assert.strictEqual(payload.data.examples.length, 1);
        assert.strictEqual(payload.data.examples[0].word_jp, "日本");
        assert.ok(Array.isArray(payload.data.folder_ids));
    });

    await t.test("GET /api/v1/kanji/:id - 404 Not Found", async () => {
        await setupTestData();
        const fakeId = crypto.randomUUID();
        const response = await app.inject({
            method: "GET",
            url: `/api/v1/kanji/${fakeId}`,
        });

        assert.strictEqual(response.statusCode, 404);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, false);
        assert.strictEqual(payload.error.code, "KANJI_NOT_FOUND");
    });

    await t.test("GET /api/v1/kanji/:id - 400 invalid UUID param", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/kanji/not-a-uuid",
        });

        assert.strictEqual(response.statusCode, 400);
    });

    // =============================================
    // POST /api/v1/admin/kanji
    // =============================================

    await t.test("POST /api/v1/admin/kanji - 401 Unauthenticated", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/admin/kanji",
            payload: {
                character: "山",
                meaning_vi: "Núi",
                stroke_count: 3,
                jlpt_level: "N5",
            },
        });

        assert.strictEqual(response.statusCode, 401);
    });

    await t.test("POST /api/v1/admin/kanji - 403 Forbidden for regular user", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/admin/kanji",
            headers: {
                authorization: `Bearer ${userToken}`,
            },
            payload: {
                character: "山",
                meaning_vi: "Núi",
                stroke_count: 3,
                jlpt_level: "N5",
            },
        });

        assert.strictEqual(response.statusCode, 403);
    });

    await t.test("POST /api/v1/admin/kanji - 201 Created by Admin", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/admin/kanji",
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
            payload: {
                character: "山",
                meaning_vi: "Núi",
                onyomi: "サン、セン",
                kunyomi: "やま",
                stroke_count: 3,
                jlpt_level: "N5",
                radical: "山",
            },
        });

        assert.strictEqual(response.statusCode, 201);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, true);
        assert.strictEqual(payload.data.character, "山");
        assert.strictEqual(payload.data.jlpt_level, "N5");
        assert.strictEqual(payload.message, "Kanji created successfully.");
    });

    await t.test("POST /api/v1/admin/kanji - 400 Bad Request missing required field", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/admin/kanji",
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
            payload: {
                // Missing required: character, meaning_vi, stroke_count, jlpt_level
                onyomi: "サン",
            },
        });

        assert.strictEqual(response.statusCode, 400);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, false);
        assert.strictEqual(payload.error.code, "VALIDATION_ERROR");
    });

    await t.test("POST /api/v1/admin/kanji - 409 DUPLICATE_KANJI", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/admin/kanji",
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
            payload: {
                character: "日", // Already exists
                meaning_vi: "Mặt trời",
                stroke_count: 4,
                jlpt_level: "N5",
            },
        });

        assert.strictEqual(response.statusCode, 409);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, false);
        assert.strictEqual(payload.error.code, "DUPLICATE_KANJI");
    });

    await t.test("POST /api/v1/admin/kanji - 400 character length must be exactly 1", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/admin/kanji",
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
            payload: {
                character: "日本", // 2 characters - invalid
                meaning_vi: "Nhật Bản",
                stroke_count: 5,
                jlpt_level: "N5",
            },
        });

        assert.strictEqual(response.statusCode, 400);
    });

    // =============================================
    // PUT /api/v1/admin/kanji/:id
    // =============================================

    await t.test("PUT /api/v1/admin/kanji/:id - 401 Unauthenticated", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "PUT",
            url: `/api/v1/admin/kanji/${testKanjiId}`,
            payload: { meaning_vi: "Ngày" },
        });

        assert.strictEqual(response.statusCode, 401);
    });

    await t.test("PUT /api/v1/admin/kanji/:id - 200 OK update meaning", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "PUT",
            url: `/api/v1/admin/kanji/${testKanjiId}`,
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
            payload: {
                meaning_vi: "Mặt trời, ngày tháng",
            },
        });

        assert.strictEqual(response.statusCode, 200);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, true);
        assert.strictEqual(payload.data.id, testKanjiId);
        assert.strictEqual(payload.message, "Kanji updated successfully.");
    });

    await t.test("PUT /api/v1/admin/kanji/:id - 400 EMPTY_UPDATE when no fields", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "PUT",
            url: `/api/v1/admin/kanji/${testKanjiId}`,
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
            payload: {},
        });

        assert.strictEqual(response.statusCode, 400);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, false);
        assert.strictEqual(payload.error.code, "EMPTY_UPDATE");
    });

    await t.test("PUT /api/v1/admin/kanji/:id - 404 Not Found", async () => {
        await setupTestData();
        const fakeId = crypto.randomUUID();
        const response = await app.inject({
            method: "PUT",
            url: `/api/v1/admin/kanji/${fakeId}`,
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
            payload: { meaning_vi: "Ngày" },
        });

        assert.strictEqual(response.statusCode, 404);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.error.code, "KANJI_NOT_FOUND");
    });

    await t.test("PUT /api/v1/admin/kanji/:id - 409 DUPLICATE_KANJI when changing character to existing", async () => {
        await setupTestData();
        // Create a second kanji to collide with
        const otherKanjiId = crypto.randomUUID();
        await prisma.kanjis.create({
            data: {
                id: otherKanjiId,
                kanji: "山",
                meaning: "Núi",
                stroke_count: 3,
                jlpt: "N5",
            },
        });

        const response = await app.inject({
            method: "PUT",
            url: `/api/v1/admin/kanji/${testKanjiId}`,
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
            payload: { character: "山" }, // Try changing 日 → 山 which already exists
        });

        assert.strictEqual(response.statusCode, 409);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.error.code, "DUPLICATE_KANJI");
    });

    // =============================================
    // DELETE /api/v1/admin/kanji/:id
    // =============================================

    await t.test("DELETE /api/v1/admin/kanji/:id - 401 Unauthenticated", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/admin/kanji/${testKanjiId}`,
        });

        assert.strictEqual(response.statusCode, 401);
    });

    await t.test("DELETE /api/v1/admin/kanji/:id - 403 Forbidden for regular user", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/admin/kanji/${testKanjiId}`,
            headers: {
                authorization: `Bearer ${userToken}`,
            },
        });

        assert.strictEqual(response.statusCode, 403);
    });

    await t.test("DELETE /api/v1/admin/kanji/:id - 200 OK soft delete and removed from list", async () => {
        await setupTestData();
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/admin/kanji/${testKanjiId}`,
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
        });

        assert.strictEqual(response.statusCode, 200);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, true);
        assert.strictEqual(payload.message, "Kanji deleted successfully.");

        // Verify the detail endpoint now returns 404 (soft-deleted)
        const detailRes = await app.inject({
            method: "GET",
            url: `/api/v1/kanji/${testKanjiId}`,
        });
        assert.strictEqual(detailRes.statusCode, 404);

        // Verify the list no longer includes the soft-deleted kanji
        const listRes = await app.inject({
            method: "GET",
            url: "/api/v1/kanji",
        });
        const listPayload = JSON.parse(listRes.payload);
        assert.strictEqual(listPayload.data.length, 0);
    });

    await t.test("DELETE /api/v1/admin/kanji/:id - 404 Not Found", async () => {
        await setupTestData();
        const fakeId = crypto.randomUUID();
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/admin/kanji/${fakeId}`,
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
        });

        assert.strictEqual(response.statusCode, 404);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.error.code, "KANJI_NOT_FOUND");
    });
});
