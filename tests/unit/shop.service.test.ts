import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { shopService } from "../../src/modules/shop/shop.service.js";
import { shopRepository } from "../../src/modules/shop/shop.repository.js";
import { memoryCache } from "../../src/common/utils/cache.js";

test("Shop Service - Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
        memoryCache.clear();
    });

    afterEach(() => {
        memoryCache.clear();
    });

    await t.test("listItems - returns active shop items with ownership overlay", async () => {
        const mockItems = [
            { id: "item-1", name: "Sakura", description: "Sakura theme", image: "sakura.png", preview_image: null, item_type: "FRAME", rarity: "RARE", price: 500, currency: "COIN", is_limited: false, stock: null }
        ];

        mock.method(shopRepository, "findActiveItems", async () => mockItems);
        mock.method(shopRepository, "findActiveItemsCount", async () => 1);
        mock.method(shopRepository, "findOwnedItemIds", async () => new Set(["item-1"]));

        const result = await shopService.listItems("user-1", { page: 1, limit: 10 });
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data[0].id, "item-1");
        assert.strictEqual(result.data[0].is_owned, true);
        assert.strictEqual(result.meta.total, 1);
    });

    await t.test("getWallet - lazy default balance if wallet is not found", async () => {
        mock.method(shopRepository, "findWallet", async () => null);

        const result = await shopService.getWallet("user-1");
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.coins, 0);
        assert.strictEqual(result.data.gems, 0);
    });

    await t.test("purchaseItem - throws ITEM_NOT_FOUND if inactive", async () => {
        mock.method(shopRepository, "findItemById", async () => ({ id: "item-1", status: "HIDDEN" }));

        await assert.rejects(
            shopService.purchaseItem("user-1", "item-1"),
            (err: any) => {
                assert.strictEqual(err.message, "ITEM_NOT_FOUND");
                return true;
            }
        );
    });

    await t.test("purchaseItem - throws ALREADY_OWNED if user owns it", async () => {
        mock.method(shopRepository, "findItemById", async () => ({ id: "item-1", status: "ACTIVE" }));
        mock.method(shopRepository, "checkItemOwned", async () => true);

        await assert.rejects(
            shopService.purchaseItem("user-1", "item-1"),
            (err: any) => {
                assert.strictEqual(err.message, "ALREADY_OWNED");
                return true;
            }
        );
    });

    await t.test("purchaseItem - throws INSUFFICIENT_BALANCE if coins are low", async () => {
        mock.method(shopRepository, "findItemById", async () => ({ id: "item-1", status: "ACTIVE", price: 500, currency: "COIN" }));
        mock.method(shopRepository, "checkItemOwned", async () => false);
        mock.method(shopRepository, "findWalletForUpdate", async () => ({ coins: 100, gems: 0 }));

        await assert.rejects(
            shopService.purchaseItem("user-1", "item-1"),
            (err: any) => {
                assert.strictEqual(err.message, "INSUFFICIENT_BALANCE");
                return true;
            }
        );
    });

    await t.test("purchaseItem - throws OUT_OF_STOCK if limited and stock is 0", async () => {
        mock.method(shopRepository, "findItemById", async () => ({ id: "item-1", status: "ACTIVE", price: 500, currency: "COIN", is_limited: true, stock: 0 }));
        mock.method(shopRepository, "checkItemOwned", async () => false);
        mock.method(shopRepository, "findWalletForUpdate", async () => ({ coins: 1000, gems: 0 }));

        await assert.rejects(
            shopService.purchaseItem("user-1", "item-1"),
            (err: any) => {
                assert.strictEqual(err.message, "OUT_OF_STOCK");
                return true;
            }
        );
    });

    await t.test("purchaseItem - updates balances and inventory", async () => {
        mock.method(shopRepository, "findItemById", async () => ({ id: "item-1", status: "ACTIVE", name: "Gold Frame", price: 500, currency: "COIN", is_limited: false }));
        mock.method(shopRepository, "checkItemOwned", async () => false);
        mock.method(shopRepository, "findWalletForUpdate", async () => ({ coins: 1000, gems: 0 }));

        const upsertWalletMock = mock.method(shopRepository, "upsertWallet", async () => ({}));
        const insertOwnedMock = mock.method(shopRepository, "insertOwnedItem", async () => ({}));
        const insertPurchaseMock = mock.method(shopRepository, "insertPurchaseHistory", async () => ({}));
        const insertWalletHistoryMock = mock.method(shopRepository, "insertWalletHistory", async () => ({}));

        const result = await shopService.purchaseItem("user-1", "item-1");
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.new_balance.coins, 500);
        assert.strictEqual(upsertWalletMock.mock.callCount(), 1);
        assert.strictEqual(insertOwnedMock.mock.callCount(), 1);
        assert.strictEqual(insertPurchaseMock.mock.callCount(), 1);
        assert.strictEqual(insertWalletHistoryMock.mock.callCount(), 1);
    });

    await t.test("equipItem - upserts user equipped state", async () => {
        mock.method(shopRepository, "checkItemOwned", async () => true);
        mock.method(shopRepository, "findItemById", async () => ({ id: "item-1", item_type: "FRAME" }));
        const upsertEquipMock = mock.method(shopRepository, "upsertEquippedItem", async () => ({}));

        const result = await shopService.equipItem("user-1", "item-1");
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.item_type, "FRAME");
        assert.strictEqual(upsertEquipMock.mock.callCount(), 1);
    });
});
