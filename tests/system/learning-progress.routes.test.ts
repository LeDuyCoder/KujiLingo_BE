import { test, mock, beforeEach } from "node:test";
import assert from "node:assert";
import app from "../../src/app.js";
import { learningProgressRepository } from "../../src/modules/learning-progress/learning-progress.repository.js";
import { authRepository } from "../../src/modules/auth/auth.repository.js";
import { signToken } from "../../src/common/utils/jwt.js";

test("Learning Progress Routes - System Tests", async (t) => {
    const testUserId = "723b10b0-394e-4f7f-85db-e877de25272a";
    let token: string;

    beforeEach(async () => {
        mock.restoreAll();
        await app.ready();

        // Generate a valid JWT token
        token = signToken({ sub: testUserId, role: "USER" });

        // Mock authRepository.findUserById to bypass database lookup for authentication
        mock.method(authRepository, "findUserById", async (id: string) => {
            if (id === testUserId) {
                return {
                    id: testUserId,
                    email: "test@example.com",
                    role: "USER",
                    status: "active"
                };
            }
            return null;
        });
    });

    await t.test("GET /api/v1/learning-progress - returns 401 if unauthenticated", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/learning-progress",
        });
        assert.strictEqual(response.statusCode, 401);
    });

    await t.test("GET /api/v1/learning-progress - returns 200 with data", async () => {
        mock.method(learningProgressRepository, "getOverviewData", async () => []);
        mock.method(learningProgressRepository, "countPlatformVocabularies", async () => 100);

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/learning-progress",
            headers: { authorization: `Bearer ${token}` }
        });
        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.platform_total_vocabulary, 100);
    });

    await t.test("POST /api/v1/learning-progress/review - returns 422 if vocab missing", async () => {
        mock.method(learningProgressRepository, "checkVocabularyExists", async () => false);

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/learning-progress/review",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
            payload: { vocabulary_id: "723b10b0-394e-4f7f-85db-e877de25272a", correct: true }
        });
        assert.strictEqual(response.statusCode, 422);
    });

    await t.test("GET /api/v1/learning-progress/history - returns 400 for bad dates", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/learning-progress/history?start_date=2026-08-05&end_date=2026-08-01",
            headers: { authorization: `Bearer ${token}` }
        });
        assert.strictEqual(response.statusCode, 400);
    });
});
