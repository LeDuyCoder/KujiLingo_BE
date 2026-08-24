import { test, mock, beforeEach } from "node:test";
import assert from "node:assert";
import app from "../../src/app.js";
import { topicsRepository } from "../../src/modules/topics/topics.repository.js";
import { authRepository } from "../../src/modules/auth/auth.repository.js";
import { adminRepository } from "../../src/modules/admin/admin.repository.js";
import { signToken } from "../../src/common/utils/jwt.js";

test("Topics Routes - System Tests", async (t) => {
    const adminUserId = "723b10b0-394e-4f7f-85db-e877de25272a";
    const regularUserId = "11111111-2222-4333-8444-555555555555";
    let adminToken: string;
    let userToken: string;

    beforeEach(async () => {
        mock.restoreAll();
        await app.ready();

        adminToken = signToken({ sub: adminUserId, role: "admin" });
        userToken = signToken({ sub: regularUserId, role: "user" });

        // Mock authRepository.findUserById
        mock.method(authRepository, "findUserById", async (id: string) => {
            if (id === adminUserId) {
                return { id: adminUserId, email: "admin@example.com", role: "admin", status: "active" };
            }
            if (id === regularUserId) {
                return { id: regularUserId, email: "user@example.com", role: "user", status: "active" };
            }
            return null;
        });
    });

    await t.test("GET /api/v1/topics/:id - returns 200 with topic details (Public)", async () => {
        mock.method(topicsRepository, "findById", async () => ({
            id: "723b10b0-394e-4f7f-85db-e877de25272a",
            lesson_id: "10000000-0000-4000-8000-000000000001",
            title: "Greetings",
            description: "Say hello",
            image: "img.png"
        }));
        mock.method(topicsRepository, "findVocabulariesByTopicId", async () => []);
        mock.method(topicsRepository, "findMeaningsByVocabulariesAndLanguages", async () => []);
        mock.method(topicsRepository, "findGrammarPointsByTopicId", async () => []);

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/topics/723b10b0-394e-4f7f-85db-e877de25272a",
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.title, "Greetings");
        assert.deepStrictEqual(body.data.grammar_points, []);
    });

    await t.test("GET /api/v1/topics/:id - returns 400 if ID is not a valid loose UUID", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/topics/invalid-uuid",
        });

        assert.strictEqual(response.statusCode, 400);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "VALIDATION_ERROR");
    });

    await t.test("POST /api/v1/admin/topics - returns 401 if unauthenticated", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/admin/topics",
            headers: { "content-type": "application/json" },
            payload: JSON.stringify({ lesson_id: "10000000-0000-4000-8000-000000000001", title: "New Topic" })
        });

        assert.strictEqual(response.statusCode, 401);
    });

    await t.test("POST /api/v1/admin/topics - returns 403 if role is not admin", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/admin/topics",
            headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
            payload: JSON.stringify({ lesson_id: "10000000-0000-4000-8000-000000000001", title: "New Topic" })
        });

        assert.strictEqual(response.statusCode, 403);
    });

    await t.test("POST /api/v1/admin/topics - returns 201 on success (Admin)", async () => {
        mock.method(topicsRepository, "checkLessonExists", async () => true);
        mock.method(topicsRepository, "createTopic", async () => ({
            id: "20000000-0000-4000-8000-000000000002",
            lesson_id: "10000000-0000-4000-8000-000000000001",
            title: "Greetings",
            order_no: 1
        }));
        mock.method(adminRepository, "createAuditLog", async () => ({}));

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/admin/topics",
            headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
            payload: JSON.stringify({ lesson_id: "10000000-0000-4000-8000-000000000001", title: "Greetings", order_no: 1 })
        });

        assert.strictEqual(response.statusCode, 201);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.title, "Greetings");
    });

    await t.test("PUT /api/v1/admin/topics/:id - returns 400 on empty update", async () => {
        const response = await app.inject({
            method: "PUT",
            url: "/api/v1/admin/topics/723b10b0-394e-4f7f-85db-e877de25272a",
            headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
            payload: JSON.stringify({})
        });

        assert.strictEqual(response.statusCode, 400);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.error.code, "EMPTY_UPDATE");
    });

    await t.test("POST /api/v1/admin/topics/:id/vocabularies - returns 201 on success (Admin)", async () => {
        mock.method(topicsRepository, "findById", async () => ({ id: "723b10b0-394e-4f7f-85db-e877de25272a" }));
        mock.method(topicsRepository, "checkVocabularyExists", async () => true);
        mock.method(topicsRepository, "checkTopicVocabularyExists", async () => false);
        mock.method(topicsRepository, "insertTopicVocabulary", async () => ({}));

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/admin/topics/723b10b0-394e-4f7f-85db-e877de25272a/vocabularies",
            headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
            payload: JSON.stringify({ vocabulary_id: "20000000-0000-4000-8000-000000000002" })
        });

        assert.strictEqual(response.statusCode, 201);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, true);
    });

    await t.test("DELETE /api/v1/admin/topics/:id/vocabularies/:vocabularyId - returns 200 (Admin)", async () => {
        mock.method(topicsRepository, "deleteTopicVocabulary", async () => ({}));

        const response = await app.inject({
            method: "DELETE",
            url: "/api/v1/admin/topics/723b10b0-394e-4f7f-85db-e877de25272a/vocabularies/20000000-0000-4000-8000-000000000002",
            headers: { authorization: `Bearer ${adminToken}` }
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, true);
    });
});
