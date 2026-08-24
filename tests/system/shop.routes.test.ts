import { test, mock, beforeEach } from "node:test";
import assert from "node:assert";
import app from "../../src/app.js";
import { shopRepository } from "../../src/modules/shop/shop.repository.js";
import { authRepository } from "../../src/modules/auth/auth.repository.js";
import { signToken } from "../../src/common/utils/jwt.js";

test("Shop Routes - System Tests", async (t) => {
    const regularUserId = "11111111-2222-4333-8444-555555555555";
    let userToken: string;

    beforeEach(async () => {
        mock.restoreAll();
        await app.ready();

        userToken = signToken({ sub: regularUserId, role: "user" });

        // Mock authRepository.findUserById
        mock.method(authRepository, "findUserById", async (id: string) => {
            if (id === regularUserId) {
                return { id: regularUserId, email: "user@example.com", role: "user", status: "active" };
            }
            return null;
        });
    });

    await t.test("GET /api/v1/shop/items - returns 200 with list of active items (Auth)", async () => {
        mock.method(shopRepository, "findActiveItems", async () => []);
        mock.method(shopRepository, "findActiveItemsCount", async () => 0);

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/shop/items",
            headers: { authorization: `Bearer ${userToken}` }
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, true);
        assert.deepStrictEqual(body.data, []);
    });

    await t.test("GET /api/v1/shop/items - returns 401 if unauthenticated", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/shop/items"
        });

        assert.strictEqual(response.statusCode, 401);
    });

    await t.test("GET /api/v1/shop/banners - returns 200 with active banners", async () => {
        mock.method(shopRepository, "findActiveBanners", async () => []);

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/shop/banners",
            headers: { authorization: `Bearer ${userToken}` }
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, true);
        assert.deepStrictEqual(body.data, []);
    });

    await t.test("GET /api/v1/shop/wallet - returns 200 with wallet balances", async () => {
        mock.method(shopRepository, "findWallet", async () => ({ coins: 1200, gems: 50, updated_at: new Date() }));

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/shop/wallet",
            headers: { authorization: `Bearer ${userToken}` }
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.coins, 1200);
        assert.strictEqual(body.data.gems, 50);
    });

    await t.test("POST /api/v1/shop/purchase - returns 201 Created on successful purchase", async () => {
        mock.method(shopRepository, "findItemById", async () => ({ id: "20000000-0000-4000-8000-000000000002", status: "ACTIVE", price: 100, currency: "COIN", is_limited: false, name: "Gold Frame" }));
        mock.method(shopRepository, "checkItemOwned", async () => false);
        mock.method(shopRepository, "findWalletForUpdate", async () => ({ coins: 500, gems: 0 }));
        mock.method(shopRepository, "upsertWallet", async () => ({}));
        mock.method(shopRepository, "insertOwnedItem", async () => ({}));
        mock.method(shopRepository, "insertPurchaseHistory", async () => ({}));
        mock.method(shopRepository, "insertWalletHistory", async () => ({}));

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/shop/purchase",
            headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
            payload: JSON.stringify({ shop_item_id: "20000000-0000-4000-8000-000000000002" })
        });

        assert.strictEqual(response.statusCode, 201);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.new_balance.coins, 400);
    });

    await t.test("POST /api/v1/shop/purchase - returns 409 Conflict if already owned", async () => {
        mock.method(shopRepository, "findItemById", async () => ({ id: "20000000-0000-4000-8000-000000000002", status: "ACTIVE" }));
        mock.method(shopRepository, "checkItemOwned", async () => true);

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/shop/purchase",
            headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
            payload: JSON.stringify({ shop_item_id: "20000000-0000-4000-8000-000000000002" })
        });

        assert.strictEqual(response.statusCode, 409);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "ALREADY_OWNED");
    });

    await t.test("POST /api/v1/shop/purchase - returns 422 if balance is insufficient", async () => {
        mock.method(shopRepository, "findItemById", async () => ({ id: "20000000-0000-4000-8000-000000000002", status: "ACTIVE", price: 1000, currency: "COIN", is_limited: false }));
        mock.method(shopRepository, "checkItemOwned", async () => false);
        mock.method(shopRepository, "findWalletForUpdate", async () => ({ coins: 100, gems: 0 }));

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/shop/purchase",
            headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
            payload: JSON.stringify({ shop_item_id: "20000000-0000-4000-8000-000000000002" })
        });

        assert.strictEqual(response.statusCode, 422);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "INSUFFICIENT_BALANCE");
    });

    await t.test("POST /api/v1/shop/equip - returns 200 on success", async () => {
        mock.method(shopRepository, "checkItemOwned", async () => true);
        mock.method(shopRepository, "findItemById", async () => ({ id: "20000000-0000-4000-8000-000000000002", item_type: "BACKGROUND" }));
        mock.method(shopRepository, "upsertEquippedItem", async () => ({}));

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/shop/equip",
            headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
            payload: JSON.stringify({ shop_item_id: "20000000-0000-4000-8000-000000000002" })
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.item_type, "BACKGROUND");
    });
});
