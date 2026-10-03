import type { FastifyReply, FastifyRequest } from "fastify";
import { shopService } from "./shop.service.js";
import { log } from "../../common/utils/log.js";

export const shopController = {
    /**
     * GET /api/v1/shop/items
     */
    async listItems(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            if (!userId) {
                return reply.status(401).send({
                    success: false,
                    error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." }
                });
            }

            const query = request.query as { item_type?: string; rarity?: string; currency?: string; page?: number; limit?: number };
            const result = await shopService.listItems(userId, query);
            return reply.status(200).send(result);
        } catch (error: any) {
            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: error.message || "An unexpected error occurred." }
            });
        }
    },

    /**
     * GET /api/v1/shop/banners
     */
    async listBanners(request: FastifyRequest, reply: FastifyReply) {
        try {
            const result = await shopService.listBanners();
            return reply.status(200).send(result);
        } catch (error: any) {
            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: error.message || "An unexpected error occurred." }
            });
        }
    },

    /**
     * GET /api/v1/shop/wallet
     */
    async getWallet(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            if (!userId) {
                return reply.status(401).send({
                    success: false,
                    error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." }
                });
            }

            const result = await shopService.getWallet(userId);
            return reply.status(200).send(result);
        } catch (error: any) {
            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: error.message || "An unexpected error occurred." }
            });
        }
    },

    /**
     * POST /api/v1/shop/purchase
     */
    async purchase(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            if (!userId) {
                return reply.status(401).send({
                    success: false,
                    error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." }
                });
            }

            const { shop_item_id } = request.body as { shop_item_id: string };
            const result = await shopService.purchaseItem(userId, shop_item_id);
            return reply.status(201).send(result);
        } catch (error: any) {
            const msg = error.message;
            if (msg === "ITEM_NOT_FOUND") {
                return reply.status(404).send({
                    success: false,
                    error: { code: "ITEM_NOT_FOUND", message: "Item not found or no longer available." }
                });
            }
            if (msg === "ALREADY_OWNED") {
                return reply.status(409).send({
                    success: false,
                    error: { code: "ALREADY_OWNED", message: "You already own this item." }
                });
            }
            if (msg === "INSUFFICIENT_BALANCE") {
                return reply.status(422).send({
                    success: false,
                    error: { code: "INSUFFICIENT_BALANCE", message: "Not enough coins or gems to purchase this item." }
                });
            }
            if (msg === "OUT_OF_STOCK") {
                return reply.status(422).send({
                    success: false,
                    error: { code: "OUT_OF_STOCK", message: "Limited item sold out." }
                });
            }

            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: error.message || "An unexpected error occurred." }
            });
        }
    },

    /**
     * GET /api/v1/shop/inventory
     */
    async getInventory(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            if (!userId) {
                return reply.status(401).send({
                    success: false,
                    error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." }
                });
            }

            const query = request.query as { item_type?: string };
            const result = await shopService.getInventory(userId, query.item_type);
            return reply.status(200).send(result);
        } catch (error: any) {
            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: error.message || "An unexpected error occurred." }
            });
        }
    },

    /**
     * POST /api/v1/shop/equip
     */
    async equip(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            if (!userId) {
                return reply.status(401).send({
                    success: false,
                    error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." }
                });
            }

            const { shop_item_id } = request.body as { shop_item_id: string };
            const result = await shopService.equipItem(userId, shop_item_id);
            return reply.status(200).send(result);
        } catch (error: any) {
            const msg = error.message;
            if (msg === "NOT_OWNED") {
                return reply.status(422).send({
                    success: false,
                    error: { code: "NOT_OWNED", message: "User does not own this item." }
                });
            }
            if (msg === "ITEM_NOT_FOUND") {
                return reply.status(404).send({
                    success: false,
                    error: { code: "ITEM_NOT_FOUND", message: "Item not found." }
                });
            }

            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: error.message || "An unexpected error occurred." }
            });
        }
    },

    /**
     * GET /api/v1/shop/equipped
     */
    async getEquipped(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            if (!userId) {
                return reply.status(401).send({
                    success: false,
                    error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." }
                });
            }

            const result = await shopService.getEquippedItems(userId);
            return reply.status(200).send(result);
        } catch (error: any) {
            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: error.message || "An unexpected error occurred." }
            });
        }
    },

    /**
     * POST /api/v1/shop/unequip
     */
    async unequip(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = request.user?.id;
            if (!userId) {
                return reply.status(401).send({
                    success: false,
                    error: { code: "UNAUTHORIZED", message: "Access token is missing, invalid, or expired." }
                });
            }

            const { item_type } = request.body as { item_type: string };
            const result = await shopService.unequipItem(userId, item_type);
            return reply.status(200).send(result);
        } catch (error: any) {
            log.error(error);

            if (error.message === "INVALID_ITEM_TYPE") {
                return reply.status(400).send({
                    success: false,
                    error: { code: "INVALID_ITEM_TYPE", message: "Invalid item type specified." }
                });
            }

            return reply.status(500).send({
                success: false,
                error: { code: "INTERNAL_ERROR", message: error.message || "An unexpected error occurred." }
            });
        }
    }
};
