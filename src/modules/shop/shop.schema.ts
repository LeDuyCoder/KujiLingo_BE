import { z } from "zod";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const looseUuid = z.string().regex(uuidRegex, "Invalid UUID format.");

// --- GET /api/v1/shop/items ---
export const listShopItemsQuerySchema = z.object({
    item_type: z.enum(["AVATAR", "BACKGROUND", "FRAME"]).optional(),
    rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"]).optional(),
    currency: z.enum(["COIN", "GEM"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const listShopItemsResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(z.object({
        id: looseUuid,
        name: z.string().nullable(),
        description: z.string().nullable(),
        image: z.string().nullable(),
        preview_image: z.string().nullable(),
        item_type: z.enum(["AVATAR", "BACKGROUND", "FRAME"]).nullable(),
        rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"]).nullable(),
        price: z.number().nullable(),
        currency: z.enum(["COIN", "GEM"]).nullable(),
        is_limited: z.boolean().nullable(),
        stock: z.number().nullable(),
        is_owned: z.boolean(),
    })),
    meta: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        total_pages: z.number(),
    }),
});

// --- GET /api/v1/shop/banners ---
export const listShopBannersResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(z.object({
        id: looseUuid,
        title: z.string().nullable(),
        description: z.string().nullable(),
        image: z.string().nullable(),
        shop_item_id: looseUuid.nullable(),
    })),
});

// --- GET /api/v1/shop/wallet ---
export const getWalletResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        coins: z.number(),
        gems: z.number(),
        updated_at: z.string().nullable().or(z.date().nullable()).or(z.any()),
    }),
});

// --- POST /api/v1/shop/purchase ---
export const purchaseItemBodySchema = z.object({
    shop_item_id: looseUuid,
});

export const purchaseItemResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        shop_item_id: looseUuid,
        item_name: z.string().nullable(),
        price: z.number().nullable(),
        currency: z.enum(["COIN", "GEM"]).nullable(),
        new_balance: z.object({
            coins: z.number(),
            gems: z.number(),
        }),
    }),
    message: z.string(),
});

// --- GET /api/v1/shop/inventory ---
export const listInventoryQuerySchema = z.object({
    item_type: z.enum(["AVATAR", "BACKGROUND", "FRAME"]).optional(),
});

export const listInventoryResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(z.object({
        shop_item_id: looseUuid,
        name: z.string().nullable(),
        item_type: z.enum(["AVATAR", "BACKGROUND", "FRAME"]).nullable(),
        image: z.string().nullable(),
        purchased_at: z.string().nullable().or(z.date().nullable()).or(z.any()),
        is_equipped: z.boolean(),
    })),
});

// --- POST /api/v1/shop/equip ---
export const equipItemBodySchema = z.object({
    shop_item_id: looseUuid,
});

export const equipItemResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        item_type: z.enum(["AVATAR", "BACKGROUND", "FRAME"]),
        shop_item_id: looseUuid,
    }),
    message: z.string(),
});

// --- GET /api/v1/shop/equipped ---
export const listEquippedResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(z.object({
        item_type: z.enum(["AVATAR", "BACKGROUND", "FRAME"]),
        shop_item_id: looseUuid.nullable(),
        name: z.string().nullable(),
        image: z.string().nullable(),
        equipped_at: z.string().nullable().or(z.date().nullable()).or(z.any()),
    })),
});
