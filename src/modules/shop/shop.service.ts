import { db } from "../../config/prisma.js";
import { shopRepository } from "./shop.repository.js";
import type { ShopItemDTO, WalletDTO, ShopBannerDTO, InventoryItemDTO, EquippedItemDTO } from "./shop.types.js";

export const shopService = {
    /**
     * List active shop items matching filters
     */
    async listItems(
        userId: string,
        query: { item_type?: string; rarity?: string; currency?: string; page?: number; limit?: number }
    ) {
        const page = query.page || 1;
        const limit = query.limit || 20;
        const skip = (page - 1) * limit;

        const filters: { item_type?: string; rarity?: string; currency?: string } = {};
        if (query.item_type) filters.item_type = query.item_type;
        if (query.rarity) filters.rarity = query.rarity;
        if (query.currency) filters.currency = query.currency;

        const [items, total] = await Promise.all([
            shopRepository.findActiveItems(filters, skip, limit),
            shopRepository.findActiveItemsCount(filters)
        ]);

        const itemIds = items.map(i => i.id);
        const ownedSet = itemIds.length > 0
            ? await shopRepository.findOwnedItemIds(userId, itemIds)
            : new Set<string>();

        const mappedItems: ShopItemDTO[] = items.map(i => ({
            id: i.id,
            name: i.name,
            description: i.description,
            image: i.image,
            preview_image: i.preview_image,
            item_type: i.item_type as any,
            rarity: i.rarity as any,
            price: i.price,
            currency: i.currency as any,
            is_limited: i.is_limited,
            stock: i.stock,
            is_owned: ownedSet.has(i.id)
        }));

        const total_pages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

        return {
            success: true,
            data: mappedItems,
            meta: {
                page,
                limit,
                total,
                total_pages
            }
        };
    },

    /**
     * Get active banners within start_at and end_at dates
     */
    async listBanners() {
        const banners = await shopRepository.findActiveBanners();
        const data: ShopBannerDTO[] = banners.map(b => ({
            id: b.id,
            title: b.title,
            description: b.description,
            image: b.image,
            shop_item_id: b.shop_item_id
        }));

        return {
            success: true,
            data
        };
    },

    /**
     * Get user wallet coins/gems balances
     */
    async getWallet(userId: string) {
        const wallet = await shopRepository.findWallet(userId);
        const data: WalletDTO = {
            coins: wallet?.coins ?? 0,
            gems: wallet?.gems ?? 0,
            updated_at: wallet?.updated_at ?? null
        };

        return {
            success: true,
            data
        };
    },

    /**
     * Execute atomic shop item purchase transaction
     */
    async purchaseItem(userId: string, shopItemId: string) {
        const result = await db.prisma.$transaction(async (tx) => {
            // 1. Fetch item
            const item = await shopRepository.findItemById(shopItemId, tx);
            if (!item || item.status !== "ACTIVE") {
                throw new Error("ITEM_NOT_FOUND");
            }

            // 2. Verify ownership
            const isOwned = await shopRepository.checkItemOwned(userId, shopItemId, tx);
            if (isOwned) {
                throw new Error("ALREADY_OWNED");
            }

            // 3. Lock wallet row FOR UPDATE
            const wallet = await shopRepository.findWalletForUpdate(tx, userId);
            const currentCoins = wallet?.coins ?? 0;
            const currentGems = wallet?.gems ?? 0;

            const itemPrice = item.price ?? 0;
            let newCoins = currentCoins;
            let newGems = currentGems;
            let coinChange = 0;
            let gemChange = 0;

            if (item.currency === "COIN") {
                if (currentCoins < itemPrice) {
                    throw new Error("INSUFFICIENT_BALANCE");
                }
                newCoins = currentCoins - itemPrice;
                coinChange = -itemPrice;
            } else if (item.currency === "GEM") {
                if (currentGems < itemPrice) {
                    throw new Error("INSUFFICIENT_BALANCE");
                }
                newGems = currentGems - itemPrice;
                gemChange = -itemPrice;
            } else {
                throw new Error("INVALID_CURRENCY");
            }

            // 4. Stock validation and atomic decrement
            if (item.is_limited === true) {
                const stock = item.stock ?? 0;
                if (stock <= 0) {
                    throw new Error("OUT_OF_STOCK");
                }
                const decremented = await shopRepository.decrementStock(tx, shopItemId);
                if (!decremented) {
                    throw new Error("OUT_OF_STOCK");
                }
            }

            // 5. Update wallet, grant item, record histories
            await shopRepository.upsertWallet(tx, userId, newCoins, newGems);
            await shopRepository.insertOwnedItem(tx, userId, shopItemId);
            await shopRepository.insertPurchaseHistory(tx, userId, shopItemId, itemPrice, item.currency ?? "COIN");
            await shopRepository.insertWalletHistory(tx, userId, "PURCHASE", coinChange, gemChange, newCoins, newGems);

            return {
                shop_item_id: shopItemId,
                item_name: item.name,
                price: itemPrice,
                currency: item.currency,
                new_balance: {
                    coins: newCoins,
                    gems: newGems
                }
            };
        });

        return {
            success: true,
            data: result,
            message: "Purchase successful."
        };
    },

    /**
     * Get user purchased inventory items with equipped flags
     */
    async getInventory(userId: string, itemType?: string) {
        const [inventory, equippedSet] = await Promise.all([
            shopRepository.findInventory(userId, itemType),
            shopRepository.findEquippedItemIds(userId)
        ]);

        const data: InventoryItemDTO[] = inventory.map(inv => ({
            shop_item_id: inv.shop_item_id ?? "",
            name: inv.shop_items?.name ?? null,
            item_type: inv.shop_items?.item_type as any,
            image: inv.shop_items?.image ?? null,
            purchased_at: inv.purchased_at,
            is_equipped: inv.shop_item_id ? equippedSet.has(inv.shop_item_id) : false
        }));

        return {
            success: true,
            data
        };
    },

    /**
     * Equip owned item to type slot (AVATAR, BACKGROUND, FRAME)
     */
    async equipItem(userId: string, shopItemId: string) {
        const isOwned = await shopRepository.checkItemOwned(userId, shopItemId);
        if (!isOwned) {
            throw new Error("NOT_OWNED");
        }

        const item = await shopRepository.findItemById(shopItemId);
        if (!item) {
            throw new Error("ITEM_NOT_FOUND");
        }

        const itemType = item.item_type;
        if (!itemType) {
            throw new Error("INVALID_ITEM_TYPE");
        }

        await db.prisma.$transaction(async (tx) => {
            await shopRepository.upsertEquippedItem(tx, userId, itemType, shopItemId);
        });

        return {
            success: true,
            data: {
                item_type: itemType,
                shop_item_id: shopItemId
            },
            message: "Item equipped."
        };
    },

    /**
     * Retrieve all items currently equipped by a user
     */
    async getEquippedItems(userId: string) {
        const equipped = await shopRepository.findEquippedItems(userId);
        const data: EquippedItemDTO[] = equipped.map(e => ({
            item_type: e.item_type as any,
            shop_item_id: e.shop_item_id,
            name: e.shop_items?.name ?? null,
            image: e.shop_items?.image ?? null,
            equipped_at: e.equipped_at
        }));

        return {
            success: true,
            data
        };
    }
};
