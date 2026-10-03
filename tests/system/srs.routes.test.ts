import { test, mock, beforeEach } from "node:test";
import assert from "node:assert";
import app from "../../src/app.js";
import { srsRepository } from "../../src/modules/srs/srs.repository.js";
import { authRepository } from "../../src/modules/auth/auth.repository.js";
import { signToken } from "../../src/common/utils/jwt.js";

test("SRS Routes - System Tests", async (t) => {
    const regularUserId = "11111111-2222-4333-8444-555555555555";
    let userToken: string;

    beforeEach(async () => {
        mock.restoreAll();
        await app.ready();

        userToken = signToken({ sub: regularUserId, role: "user" });

        mock.method(authRepository, "findUserById", async (id: string) => {
            if (id === regularUserId) {
                return { id: regularUserId, email: "user@example.com", role: "user", status: "active" };
            }
            return null;
        });
    });

    await t.test("GET /api/v1/srs/due - returns 200 with list of due cards (Auth)", async () => {
        mock.method(srsRepository, "findDueCards", async () => []);

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/srs/due",
            headers: { authorization: `Bearer ${userToken}` }
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, true);
        assert.deepStrictEqual(body.data, []);
    });

    await t.test("GET /api/v1/srs/due - returns 401 if unauthenticated", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/srs/due"
        });

        assert.strictEqual(response.statusCode, 401);
    });

    await t.test("POST /api/v1/srs/cards/:cardId/review - returns 200 on successful review", async () => {
        mock.method(srsRepository, "findCardByIdAndUser", async () => ({
            id: "20000000-0000-4000-8000-000000000002",
            user_id: regularUserId,
            repetitions: 1,
            interval_days: 1,
            ease_factor: 2.5,
            state: "learning"
        }));
        mock.method(srsRepository, "updateCard", async () => ({}));
        mock.method(srsRepository, "insertReviewHistory", async () => ({}));
        mock.method(srsRepository, "upsertDailyStatistics", async () => ({}));

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/srs/cards/20000000-0000-4000-8000-000000000002/review",
            headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
            payload: JSON.stringify({ rating: "good" })
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.new_interval_days, 6); // good rating transition from repetitions=1 -> 6 days
    });

    await t.test("POST /api/v1/srs/cards/:cardId/review - returns 404 if card not found", async () => {
        mock.method(srsRepository, "findCardByIdAndUser", async () => null);

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/srs/cards/20000000-0000-4000-8000-000000000002/review",
            headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
            payload: JSON.stringify({ rating: "good" })
        });

        assert.strictEqual(response.statusCode, 404);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "CARD_NOT_FOUND");
    });

    await t.test("POST /api/v1/srs/items - returns 201 on success", async () => {
        mock.method(srsRepository, "checkVocabularyExists", async () => true);
        mock.method(srsRepository, "findCardByUserAndItem", async () => null);
        mock.method(srsRepository, "insertCard", async () => ({
            id: "20000000-0000-4000-8000-000000000002",
            item_type: "vocabulary",
            item_id: "30000000-0000-4000-8000-000000000003",
            state: "new",
            due_at: new Date()
        }));

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/srs/items",
            headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
            payload: JSON.stringify({ item_type: "vocabulary", item_id: "30000000-0000-4000-8000-000000000003" })
        });

        assert.strictEqual(response.statusCode, 201);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.state, "new");
    });

    await t.test("POST /api/v1/srs/items - returns 422 if item does not exist", async () => {
        mock.method(srsRepository, "checkVocabularyExists", async () => false);

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/srs/items",
            headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
            payload: JSON.stringify({ item_type: "vocabulary", item_id: "30000000-0000-4000-8000-000000000003" })
        });

        assert.strictEqual(response.statusCode, 422);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "INVALID_ITEM_REFERENCE");
    });

    await t.test("POST /api/v1/srs/items - returns 409 if already in SRS", async () => {
        mock.method(srsRepository, "checkVocabularyExists", async () => true);
        mock.method(srsRepository, "findCardByUserAndItem", async () => ({ id: "card-1" }));

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/srs/items",
            headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
            payload: JSON.stringify({ item_type: "vocabulary", item_id: "30000000-0000-4000-8000-000000000003" })
        });

        assert.strictEqual(response.statusCode, 409);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "ITEM_ALREADY_IN_SRS");
    });
});
