import { test, beforeEach, after, mock } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { signToken } from "../../src/common/utils/jwt.js";
import { payOSAdapter } from "../../src/modules/gems/payos.client.js";

async function clearDatabase() {
    await prisma.wallet_histories.deleteMany({
        where: { users: { email: { startsWith: "gemstest_" } } },
    }).catch(() => {});
    await prisma.payment_transactions.deleteMany({
        where: { users: { email: { startsWith: "gemstest_" } } },
    }).catch(() => {});
    await prisma.user_wallets.deleteMany({
        where: { users: { email: { startsWith: "gemstest_" } } },
    }).catch(() => {});
    await prisma.users.deleteMany({
        where: { email: { startsWith: "gemstest_" } },
    }).catch(() => {});
    await prisma.gem_packages.deleteMany({
        where: { title: { startsWith: "Test Package" } },
    }).catch(() => {});
    await prisma.gem_promotions.deleteMany({
        where: { title: { startsWith: "Test Promo" } },
    }).catch(() => {});
}

test("Gems API System Tests", async (t) => {
    let testUser: any;
    let userToken: string;

    beforeEach(async () => {
        mock.restoreAll();
        await app.ready();
        await clearDatabase();

        testUser = await prisma.users.create({
            data: {
                id: crypto.randomUUID(),
                email: `gemstest_${Date.now()}_${Math.random()}@example.com`,
                password_hash: "hashed",
                display_name: "Gems Test User",
                role: "USER",
                status: "active",
            },
        });

        userToken = signToken({ sub: testUser.id, role: testUser.role });
    });

    after(async () => {
        await clearDatabase();
    });

    // =========================================================================
    // 1. GET /api/v1/gems/packages
    // =========================================================================
    await t.test("GET /api/v1/gems/packages - 401 Unauthenticated", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/gems/packages",
        });

        assert.strictEqual(res.statusCode, 401);
    });

    await t.test("GET /api/v1/gems/packages - 200 Returns active packages & promotion", async () => {
        const pkg = await prisma.gem_packages.create({
            data: {
                id: crypto.randomUUID(),
                title: "Test Package Starter",
                gem_amount: 100,
                bonus_gem: 10,
                price: 29000 as any,
                sort_order: 1,
                is_active: true,
            },
        });

        const res = await app.inject({
            method: "GET",
            url: "/api/v1/gems/packages",
            headers: {
                authorization: `Bearer ${userToken}`,
            },
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.ok(Array.isArray(body.data.packages));
        const found = body.data.packages.find((p: any) => p.id === pkg.id);
        assert.ok(found);
        assert.strictEqual(found.gem_amount, 100);
    });

    // =========================================================================
    // 2. GET /api/v1/gems/promotions/active
    // =========================================================================
    await t.test("GET /api/v1/gems/promotions/active - 401 Unauthenticated", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/gems/promotions/active",
        });

        assert.strictEqual(res.statusCode, 401);
    });

    await t.test("GET /api/v1/gems/promotions/active - 200 Returns active promotion or null", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/gems/promotions/active",
            headers: {
                authorization: `Bearer ${userToken}`,
            },
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
    });

    // =========================================================================
    // 3. POST /api/v1/gems/transactions
    // =========================================================================
    await t.test("POST /api/v1/gems/transactions - 401 Unauthenticated", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/api/v1/gems/transactions",
            payload: { package_id: crypto.randomUUID() },
        });

        assert.strictEqual(res.statusCode, 401);
    });

    await t.test("POST /api/v1/gems/transactions - 422 Invalid package", async () => {
        const res = await app.inject({
            method: "POST",
            url: "/api/v1/gems/transactions",
            headers: { authorization: `Bearer ${userToken}` },
            payload: { package_id: crypto.randomUUID() },
        });

        assert.strictEqual(res.statusCode, 422);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.error.code, "INVALID_PACKAGE");
    });

    await t.test("POST /api/v1/gems/transactions - 201 Success create payment transaction", async () => {
        const pkg = await prisma.gem_packages.create({
            data: {
                id: crypto.randomUUID(),
                title: "Test Package Recharge",
                gem_amount: 200,
                bonus_gem: 20,
                price: 59000 as any,
                sort_order: 2,
                is_active: true,
            },
        });

        mock.method(payOSAdapter, "createPaymentLink", async () => ({
            checkoutUrl: "https://pay.payos.vn/web/test-link",
            qrCode: "000201...",
            paymentLinkId: "link-test-123",
        }));

        const res = await app.inject({
            method: "POST",
            url: "/api/v1/gems/transactions",
            headers: { authorization: `Bearer ${userToken}` },
            payload: { package_id: pkg.id },
        });

        assert.strictEqual(res.statusCode, 201);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.payment_url, "https://pay.payos.vn/web/test-link");
        assert.strictEqual(body.data.gem_amount, 200);
        assert.ok(body.data.total_gem >= 220);
    });

    // =========================================================================
    // 4. POST /api/v1/gems/callback/payos
    // =========================================================================
    await t.test("POST /api/v1/gems/callback/payos - 400 Invalid signature", async () => {
        mock.method(payOSAdapter, "verifyWebhook", async () => {
            throw new Error("Invalid signature");
        });

        const res = await app.inject({
            method: "POST",
            url: "/api/v1/gems/callback/payos",
            payload: { code: "00", success: true, data: { orderCode: 123 }, signature: "invalid" },
        });

        assert.strictEqual(res.statusCode, 400);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.error.code, "INVALID_SIGNATURE");
    });

    await t.test("POST /api/v1/gems/callback/payos - 200 Success credit gems", async () => {
        const orderCode = Math.floor(1000000000 + Math.random() * 8000000000);
        const tx = await prisma.payment_transactions.create({
            data: {
                id: crypto.randomUUID(),
                user_id: testUser.id,
                payment_method: "PAYOS",
                payment_status: "PENDING",
                amount: 29000 as any,
                gem_amount: 100,
                bonus_gem: 10,
                total_gem: 110,
                transaction_code: `KL-${Date.now()}-TEST`,
                order_code: BigInt(orderCode),
            },
        });

        const callbackPayload = {
            code: "00",
            success: true,
            data: {
                orderCode,
                amount: 29000,
                reference: "FT-TEST-REF",
            },
            signature: "valid-sig",
        };

        mock.method(payOSAdapter, "verifyWebhook", () => callbackPayload.data);

        const res = await app.inject({
            method: "POST",
            url: "/api/v1/gems/callback/payos",
            payload: callbackPayload,
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);

        // Check user wallet updated
        const wallet = await prisma.user_wallets.findUnique({ where: { user_id: testUser.id } });
        assert.strictEqual(wallet?.gems, 110);
    });

    // =========================================================================
    // 5. GET /api/v1/gems/transactions/:transactionId
    // =========================================================================
    await t.test("GET /api/v1/gems/transactions/:id - 404 Transaction Not Found", async () => {
        const res = await app.inject({
            method: "GET",
            url: `/api/v1/gems/transactions/${crypto.randomUUID()}`,
            headers: { authorization: `Bearer ${userToken}` },
        });

        assert.strictEqual(res.statusCode, 404);
    });

    await t.test("GET /api/v1/gems/transactions/:id - 200 Success status", async () => {
        const orderCode = Math.floor(1000000000 + Math.random() * 8000000000);
        const tx = await prisma.payment_transactions.create({
            data: {
                id: crypto.randomUUID(),
                user_id: testUser.id,
                payment_method: "PAYOS",
                payment_status: "SUCCESS",
                amount: 29000 as any,
                gem_amount: 100,
                bonus_gem: 10,
                total_gem: 110,
                transaction_code: `KL-${Date.now()}-STATUS`,
                order_code: BigInt(orderCode),
                paid_at: new Date(),
            },
        });

        const res = await app.inject({
            method: "GET",
            url: `/api/v1/gems/transactions/${tx.id}`,
            headers: { authorization: `Bearer ${userToken}` },
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.payment_status, "SUCCESS");
        assert.strictEqual(body.data.total_gem, 110);
    });

    // =========================================================================
    // 6. GET /api/v1/gems/wallet-history
    // =========================================================================
    await t.test("GET /api/v1/gems/wallet-history - 200 Success history list", async () => {
        await prisma.wallet_histories.create({
            data: {
                id: crypto.randomUUID(),
                user_id: testUser.id,
                transaction_type: "RECHARGE",
                coin_change: 0,
                gem_change: 110,
                balance_coin: 0,
                balance_gem: 110,
                note: "Purchased Starter Pack",
                created_at: new Date(),
            },
        });

        const res = await app.inject({
            method: "GET",
            url: "/api/v1/gems/wallet-history",
            headers: { authorization: `Bearer ${userToken}` },
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.length, 1);
        assert.strictEqual(body.data[0].gem_change, 110);
    });
});
