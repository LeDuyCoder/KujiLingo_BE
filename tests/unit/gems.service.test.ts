import { test, mock, beforeEach } from "node:test";
import assert from "node:assert";
import { gemsService } from "../../src/modules/gems/gems.service.js";
import { gemsRepository } from "../../src/modules/gems/gems.repository.js";
import { payOSAdapter } from "../../src/modules/gems/payos.client.js";

test("Gems Service - Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
    });

    await t.test("listPackages - returns active packages with computed bonus from active promotion", async () => {
        const mockPackages = [
            {
                id: "pkg-1",
                title: "Starter Pack",
                gem_amount: 100,
                bonus_gem: 10,
                price: 29000 as any,
                image: "https://example.com/starter.png",
                is_popular: false,
                is_best_value: false,
                sort_order: 1,
                is_active: true,
            },
        ];

        const mockPromotion = {
            id: "promo-1",
            title: "Summer Bonus +10%",
            description: "10% Extra",
            bonus_percent: 10,
            start_at: new Date("2026-08-01"),
            end_at: new Date("2026-08-30"),
            is_active: true,
        };

        mock.method(gemsRepository, "findActivePackages", async () => mockPackages as any);
        mock.method(gemsRepository, "findActivePromotion", async () => mockPromotion as any);

        const result = await gemsService.listPackages();

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.packages.length, 1);
        // Base 10 + Math.floor(100 * 10 / 100) = 10 + 10 = 20
        assert.strictEqual(result.data.packages[0].effective_bonus_gem, 20);
        assert.strictEqual(result.data.packages[0].total_gems, 120);
        assert.notStrictEqual(result.data.active_promotion, null);
        assert.strictEqual(result.data.active_promotion?.bonus_percent, 10);
    });

    await t.test("listPackages - when no active promotion, effective_bonus_gem equals base bonus_gem", async () => {
        const mockPackages = [
            {
                id: "pkg-1",
                title: "Starter Pack",
                gem_amount: 100,
                bonus_gem: 10,
                price: 29000 as any,
                image: null,
                is_popular: false,
                is_best_value: false,
                sort_order: 1,
                is_active: true,
            },
        ];

        mock.method(gemsRepository, "findActivePackages", async () => mockPackages as any);
        mock.method(gemsRepository, "findActivePromotion", async () => null);

        const result = await gemsService.listPackages();

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.packages[0].effective_bonus_gem, 10);
        assert.strictEqual(result.data.packages[0].total_gems, 110);
        assert.strictEqual(result.data.active_promotion, null);
    });

    await t.test("getActivePromotion - returns single active promotion", async () => {
        const mockPromo = {
            id: "promo-1",
            title: "Summer Bonus +10%",
            description: "10% Extra",
            bonus_percent: 10,
            start_at: new Date("2026-08-01"),
            end_at: new Date("2026-08-30"),
            is_active: true,
        };

        mock.method(gemsRepository, "findActivePromotion", async () => mockPromo as any);

        const result = await gemsService.getActivePromotion();

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data?.id, "promo-1");
        assert.strictEqual(result.data?.bonus_percent, 10);
    });

    await t.test("createTransaction - throws INVALID_PACKAGE if package missing or inactive", async () => {
        mock.method(gemsRepository, "findActivePackageById", async () => null);

        await assert.rejects(
            gemsService.createTransaction("user-1", "user@example.com", "invalid-pkg-id"),
            /INVALID_PACKAGE/
        );
    });

    await t.test("createTransaction - initiates PENDING transaction and calls PayOS", async () => {
        const mockPkg = {
            id: "pkg-1",
            gem_amount: 100,
            bonus_gem: 10,
            price: 29000 as any,
        };

        mock.method(gemsRepository, "findActivePackageById", async () => mockPkg as any);
        mock.method(gemsRepository, "findActivePromotion", async () => null);
        mock.method(gemsRepository, "createPendingTransaction", async () => ({
            id: "tx-123",
            user_id: "user-1",
            transaction_code: "KL-12345-ABC",
            order_code: 1735000000123n,
        }) as any);

        mock.method(payOSAdapter, "createPaymentLink", async () => ({
            checkoutUrl: "https://pay.payos.vn/web/123",
            qrCode: "000201...",
            paymentLinkId: "link-123",
        }));

        mock.method(gemsRepository, "updateTransactionCheckoutDetails", async () => ({}));

        const result = await gemsService.createTransaction("user-1", "user@example.com", "pkg-1");

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.transaction_id, "tx-123");
        assert.strictEqual(result.data.payment_url, "https://pay.payos.vn/web/123");
        assert.strictEqual(result.data.total_gem, 110);
    });

    await t.test("handlePayOSCallback - updates transaction and credits gems atomically", async () => {
        const webhookBody = {
            code: "00",
            success: true,
            data: {
                orderCode: 1735000000123,
                reference: "FT123456",
            },
            signature: "valid-signature",
        };

        mock.method(payOSAdapter, "verifyWebhook", async () => webhookBody.data);
        mock.method(gemsRepository, "findByOrderCode", async () => ({
            id: "tx-123",
            user_id: "user-1",
            payment_status: "PENDING",
            total_gem: 120,
            gem_packages: { title: "Starter Pack" },
        }) as any);

        const fulfillMock = mock.method(gemsRepository, "fulfillSuccessfulPayment", async () => ({}) as any);

        const result = await gemsService.handlePayOSCallback(webhookBody);

        assert.strictEqual(result.success, true);
        assert.strictEqual(fulfillMock.mock.callCount(), 1);
    });

    await t.test("handlePayOSCallback - idempotent on already SUCCESS transaction", async () => {
        const webhookBody = {
            code: "00",
            success: true,
            data: { orderCode: 1735000000123 },
            signature: "valid-sig",
        };

        mock.method(payOSAdapter, "verifyWebhook", async () => webhookBody.data);
        mock.method(gemsRepository, "findByOrderCode", async () => ({
            id: "tx-123",
            user_id: "user-1",
            payment_status: "SUCCESS",
            total_gem: 120,
        }) as any);

        const fulfillMock = mock.method(gemsRepository, "fulfillSuccessfulPayment", async () => ({}) as any);

        const result = await gemsService.handlePayOSCallback(webhookBody);

        assert.strictEqual(result.success, true);
        assert.strictEqual(fulfillMock.mock.callCount(), 0);
    });

    await t.test("getTransactionStatus - returns transaction status", async () => {
        mock.method(gemsRepository, "findByIdAndUser", async () => ({
            id: "tx-123",
            user_id: "user-1",
            payment_status: "SUCCESS",
            total_gem: 120,
            amount: 29000 as any,
            paid_at: new Date("2026-08-24T08:05:00Z"),
        }) as any);

        const result = await gemsService.getTransactionStatus("tx-123", "user-1");

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.payment_status, "SUCCESS");
        assert.strictEqual(result.data.total_gem, 120);
    });

    await t.test("getWalletHistory - returns paginated history list", async () => {
        const mockItems = [
            {
                id: "wh-1",
                transaction_type: "RECHARGE",
                coin_change: 0,
                gem_change: 120,
                balance_coin: 100,
                balance_gem: 120,
                note: "Purchased Starter Pack",
                created_at: new Date("2026-08-24T08:05:00Z"),
            },
        ];

        mock.method(gemsRepository, "findWalletHistoryByUser", async () => ({
            items: mockItems as any,
            total: 1,
        }));

        const result = await gemsService.getWalletHistory("user-1", { page: 1, limit: 20 });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.length, 1);
        assert.strictEqual(result.data[0].gem_change, 120);
        assert.strictEqual(result.meta.total, 1);
    });
});
