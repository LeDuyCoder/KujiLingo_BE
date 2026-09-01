import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { authGuard } from "../../common/middlewares/auth.guard.js";
import { shopController } from "./shop.controller.js";
import {
    listShopItemsQuerySchema,
    listShopItemsResponseSchema,
    listShopBannersResponseSchema,
    getWalletResponseSchema,
    purchaseItemBodySchema,
    purchaseItemResponseSchema,
    listInventoryQuerySchema,
    listInventoryResponseSchema,
    equipItemBodySchema,
    equipItemResponseSchema,
    listEquippedResponseSchema,
    unequipItemBodySchema,
    unequipItemResponseSchema
} from "./shop.schema.js";

export async function shopRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    // Apply authGuard to all shop routes
    router.addHook("preHandler", authGuard);

    // 1. List Shop Items
    router.get(
        "/api/v1/shop/items",
        {
            schema: {
                tags: ["Shop"],
                summary: "List Shop Items",
                description: "Returns available shop items with ownership state.",
                querystring: listShopItemsQuerySchema,
                response: {
                    200: listShopItemsResponseSchema,
                    401: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    500: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) })
                }
            }
        },
        shopController.listItems
    );

    // 2. Get Shop Banners
    router.get(
        "/api/v1/shop/banners",
        {
            schema: {
                tags: ["Shop"],
                summary: "Get Shop Banners",
                description: "Returns active promotional banners.",
                response: {
                    200: listShopBannersResponseSchema,
                    401: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    500: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) })
                }
            }
        },
        shopController.listBanners
    );

    // 3. Get My Wallet
    router.get(
        "/api/v1/shop/wallet",
        {
            schema: {
                tags: ["Shop"],
                summary: "Get My Wallet",
                description: "Returns user coin and gem balance.",
                response: {
                    200: getWalletResponseSchema,
                    401: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    500: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) })
                }
            }
        },
        shopController.getWallet
    );

    // 4. Purchase Item
    router.post(
        "/api/v1/shop/purchase",
        {
            schema: {
                tags: ["Shop"],
                summary: "Purchase Shop Item",
                description: "Deducts price and grants ownership.",
                body: purchaseItemBodySchema,
                response: {
                    201: purchaseItemResponseSchema,
                    400: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    401: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    404: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    409: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    422: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    500: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) })
                }
            }
        },
        shopController.purchase
    );

    // 5. Get Inventory
    router.get(
        "/api/v1/shop/inventory",
        {
            schema: {
                tags: ["Shop"],
                summary: "Get My Purchased Items",
                description: "Returns items user already owns.",
                querystring: listInventoryQuerySchema,
                response: {
                    200: listInventoryResponseSchema,
                    401: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    500: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) })
                }
            }
        },
        shopController.getInventory
    );

    // 6. Equip Item
    router.post(
        "/api/v1/shop/equip",
        {
            schema: {
                tags: ["Shop"],
                summary: "Equip Item",
                description: "Sets item as active for its slot.",
                body: equipItemBodySchema,
                response: {
                    200: equipItemResponseSchema,
                    401: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    422: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    500: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) })
                }
            }
        },
        shopController.equip
    );

    // 7. Get Equipped Items
    router.get(
        "/api/v1/shop/equipped",
        {
            schema: {
                tags: ["Shop"],
                summary: "Get Equipped Items",
                description: "Returns currently equipped items for all slots.",
                response: {
                    200: listEquippedResponseSchema,
                    401: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    500: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) })
                }
            }
        },
        shopController.getEquipped
    );

    // 8. Unequip Item
    router.post(
        "/api/v1/shop/unequip",
        {
            schema: {
                tags: ["Shop"],
                summary: "Unequip Item",
                description: "Removes currently equipped item from a slot.",
                body: unequipItemBodySchema,
                response: {
                    200: unequipItemResponseSchema,
                    400: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    401: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) }),
                    500: z.object({ success: z.boolean(), error: z.object({ code: z.string(), message: z.string() }) })
                }
            }
        },
        shopController.unequip
    );
}
