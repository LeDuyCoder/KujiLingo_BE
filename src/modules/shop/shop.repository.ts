import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import crypto from "node:crypto";

type TransactionClient = Prisma.TransactionClient;

export const shopRepository = {
    /**
     * Count active items matching filter query criteria
     */
    async findActiveItemsCount(filters: { item_type?: string; rarity?: string; currency?: string }, tx?: TransactionClient) {
        const client = tx || prisma;
        return client.shop_items.count({
            where: {
                status: "ACTIVE",
                OR: [
                    { is_limited: false },
                    { is_limited: true, stock: { gt: 0 } }
                ],
                ...(filters.item_type && { item_type: filters.item_type as any }),
                ...(filters.rarity && { rarity: filters.rarity as any }),
                ...(filters.currency && { currency: filters.currency as any })
            }
        });
    },

    /**
     * Retrieve active items sorted by rarity desc, price asc
     */
    async findActiveItems(
        filters: { item_type?: string; rarity?: string; currency?: string },
        skip: number,
        take: number,
        tx?: TransactionClient
    ) {
        const client = tx || prisma;
        return client.shop_items.findMany({
            where: {
                status: "ACTIVE",
                OR: [
                    { is_limited: false },
                    { is_limited: true, stock: { gt: 0 } }
                ],
                ...(filters.item_type && { item_type: filters.item_type as any }),
                ...(filters.rarity && { rarity: filters.rarity as any }),
                ...(filters.currency && { currency: filters.currency as any })
            },
            skip,
            take,
            orderBy: [
                { rarity: "desc" },
                { price: "asc" }
            ]
        });
    },

    /**
     * Batch check item ownership mapping for a user
     */
    async findOwnedItemIds(userId: string, itemIds: string[], tx?: TransactionClient): Promise<Set<string>> {
        const client = tx || prisma;
        const owned = await client.user_shop_items.findMany({
            where: {
                user_id: userId,
                shop_item_id: { in: itemIds }
            },
            select: {
                shop_item_id: true
            }
        });
        return new Set(owned.map(o => o.shop_item_id).filter((id): id is string => id !== null));
    },

    /**
     * Retrieve active promotional banners
     */
    async findActiveBanners(tx?: TransactionClient) {
        const client = tx || prisma;
        const now = new Date();
        return client.shop_banners.findMany({
            where: {
                is_active: true,
                start_at: { lte: now },
                end_at: { gte: now }
            }
        });
    },

    /**
     * Retrieve user wallet details
     */
    async findWallet(userId: string, tx?: TransactionClient) {
        const client = tx || prisma;
        return client.user_wallets.findUnique({
            where: { user_id: userId }
        });
    },

    /**
     * Lock user's wallet row using FOR UPDATE raw query
     */
    async findWalletForUpdate(tx: TransactionClient, userId: string) {
        const list = await tx.$queryRaw<any[]>`
            SELECT * FROM "user_wallets"
            WHERE "user_id" = ${userId}::uuid
            LIMIT 1
            FOR UPDATE
        `;
        return list[0] || null;
    },

    /**
     * Create or update wallet balance values
     */
    async upsertWallet(tx: TransactionClient, userId: string, coins: number, gems: number) {
        return tx.user_wallets.upsert({
            where: { user_id: userId },
            create: {
                user_id: userId,
                coins,
                gems,
                updated_at: new Date()
            },
            update: {
                coins,
                gems,
                updated_at: new Date()
            }
        });
    },

    /**
     * Find single shop item by ID
     */
    async findItemById(id: string, tx?: TransactionClient) {
        const client = tx || prisma;
        return client.shop_items.findUnique({
            where: { id }
        });
    },

    /**
     * Check if user already owns the specific item
     */
    async checkItemOwned(userId: string, shopItemId: string, tx?: TransactionClient): Promise<boolean> {
        const client = tx || prisma;
        const count = await client.user_shop_items.count({
            where: {
                user_id: userId,
                shop_item_id: shopItemId
            }
        });
        return count > 0;
    },

    /**
     * Record a user shop item purchase ownership link
     */
    async insertOwnedItem(tx: TransactionClient, userId: string, shopItemId: string) {
        return tx.user_shop_items.create({
            data: {
                id: crypto.randomUUID(),
                user_id: userId,
                shop_item_id: shopItemId,
                purchased_at: new Date()
            }
        });
    },

    /**
     * Append to purchase histories
     */
    async insertPurchaseHistory(tx: TransactionClient, userId: string, shopItemId: string, price: number, currency: string) {
        return tx.purchase_histories.create({
            data: {
                id: crypto.randomUUID(),
                user_id: userId,
                shop_item_id: shopItemId,
                price,
                currency: currency as any,
                purchased_at: new Date()
            }
        });
    },

    /**
     * Append to wallet histories
     */
    async insertWalletHistory(
        tx: TransactionClient,
        userId: string,
        type: string,
        coinChange: number,
        gemChange: number,
        finalCoins: number,
        finalGems: number
    ) {
        return tx.wallet_histories.create({
            data: {
                id: crypto.randomUUID(),
                user_id: userId,
                transaction_type: type as any,
                coin_change: coinChange,
                gem_change: gemChange,
                balance_coin: finalCoins,
                balance_gem: finalGems,
                created_at: new Date()
            }
        });
    },

    /**
     * Atomically decrement stock by 1 if stock is greater than 0
     */
    async decrementStock(tx: TransactionClient, shopItemId: string): Promise<boolean> {
        const result = await tx.shop_items.updateMany({
            where: {
                id: shopItemId,
                stock: { gt: 0 }
            },
            data: {
                stock: { decrement: 1 }
            }
        });
        return result.count > 0;
    },

    /**
     * Retrieve user purchased shop inventory with items details
     */
    async findInventory(userId: string, itemType?: string, tx?: TransactionClient) {
        const client = tx || prisma;
        return client.user_shop_items.findMany({
            where: {
                user_id: userId,
                ...(itemType && {
                    shop_items: {
                        item_type: itemType as any
                    }
                })
            },
            include: {
                shop_items: true
            },
            orderBy: {
                purchased_at: "desc"
            }
        });
    },

    /**
     * Get equipped shop item ids mapping for a user
     */
    async findEquippedItemIds(userId: string, tx?: TransactionClient): Promise<Set<string>> {
        const client = tx || prisma;
        const list = await client.user_equipped_items.findMany({
            where: { user_id: userId },
            select: {
                shop_item_id: true
            }
        });
        return new Set(list.map(e => e.shop_item_id).filter((id): id is string => id !== null));
    },

    /**
     * Record or replace equipped item for a specific type slot
     */
    async upsertEquippedItem(tx: TransactionClient, userId: string, itemType: string, shopItemId: string) {
        return tx.user_equipped_items.upsert({
            where: {
                user_id_item_type: {
                    user_id: userId,
                    item_type: itemType as any
                }
            },
            create: {
                user_id: userId,
                item_type: itemType as any,
                shop_item_id: shopItemId,
                equipped_at: new Date()
            },
            update: {
                shop_item_id: shopItemId,
                equipped_at: new Date()
            }
        });
    },

    /**
     * List user's equipped items joined with items details
     */
    async findEquippedItems(userId: string, tx?: TransactionClient) {
        const client = tx || prisma;
        return client.user_equipped_items.findMany({
            where: { user_id: userId },
            include: {
                shop_items: true
            }
        });
    }
};
