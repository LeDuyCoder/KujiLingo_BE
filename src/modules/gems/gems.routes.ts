import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { authGuard } from "../../common/middlewares/auth.guard.js";
import {
    listPackagesHandler,
    getActivePromotionHandler,
    createTransactionHandler,
    payosCallbackHandler,
    getTransactionStatusHandler,
    getWalletHistoryHandler,
} from "./gems.controller.js";
import {
    createTransactionBodySchema,
    getTransactionParamsSchema,
    walletHistoryQuerySchema,
} from "./gems.schema.js";

export async function gemsRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();

    // 1. List Gem Packages
    router.get(
        "/api/v1/gems/packages",
        {
            preHandler: [authGuard],
            schema: {
                tags: ["Gems & Wallet"],
                summary: "List Gem Packages",
                description: "Returns active gem packages with computed bonus gems based on active promotion.",
                response: {
                    200: z.object({
                        success: z.literal(true),
                        data: z.object({
                            packages: z.array(
                                z.object({
                                    id: z.string().uuid(),
                                    title: z.string(),
                                    gem_amount: z.number(),
                                    bonus_gem: z.number(),
                                    effective_bonus_gem: z.number(),
                                    total_gems: z.number(),
                                    price: z.number(),
                                    image: z.string().nullable(),
                                    is_popular: z.boolean(),
                                    is_best_value: z.boolean(),
                                })
                            ),
                            active_promotion: z
                                .object({
                                    id: z.string().uuid(),
                                    title: z.string(),
                                    bonus_percent: z.number(),
                                    end_at: z.string(),
                                })
                                .nullable(),
                        }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        listPackagesHandler as any
    );

    // 2. Get Active Promotions
    router.get(
        "/api/v1/gems/promotions/active",
        {
            preHandler: [authGuard],
            schema: {
                tags: ["Gems & Wallet"],
                summary: "Get Active Promotions",
                description: "Returns the current active promotion with highest bonus percentage.",
                response: {
                    200: z.object({
                        success: z.literal(true),
                        data: z
                            .object({
                                id: z.string().uuid(),
                                title: z.string(),
                                description: z.string().nullable(),
                                bonus_percent: z.number(),
                                start_at: z.string(),
                                end_at: z.string(),
                            })
                            .nullable(),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        getActivePromotionHandler as any
    );

    // 3. Create Payment Transaction (Initiate Recharge)
    router.post(
        "/api/v1/gems/transactions",
        {
            preHandler: [authGuard],
            schema: {
                tags: ["Gems & Wallet"],
                summary: "Create Payment Transaction",
                description: "Initiates a gem purchase by creating a pending transaction and calling PayOS.",
                body: createTransactionBodySchema,
                response: {
                    201: z.object({
                        success: z.literal(true),
                        data: z.object({
                            transaction_id: z.string().uuid(),
                            transaction_code: z.string(),
                            order_code: z.number(),
                            payment_url: z.string(),
                            qr_code: z.string().nullable(),
                            amount: z.number(),
                            gem_amount: z.number(),
                            bonus_gem: z.number(),
                            total_gem: z.number(),
                            expired_at: z.string(),
                        }),
                        message: z.string(),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.string(), message: z.string() }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() }),
                    }),
                    422: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INVALID_PACKAGE"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.string(), message: z.string() }),
                    }),
                },
            },
        },
        createTransactionHandler as any
    );

    // 4. Payment Callback (Webhook)
    router.post(
        "/api/v1/gems/callback/payos",
        {
            schema: {
                tags: ["Gems & Wallet"],
                summary: "PayOS Payment Webhook Callback",
                description: "Asynchronous webhook called by PayOS to confirm payment success or failure.",
                response: {
                    200: z.object({
                        success: z.literal(true),
                    }),
                    400: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.string(), message: z.string() }),
                    }),
                    404: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("TRANSACTION_NOT_FOUND"), message: z.string() }),
                    }),
                },
            },
        },
        payosCallbackHandler as any
    );

    // 5. Get Transaction Status
    router.get(
        "/api/v1/gems/transactions/:transactionId",
        {
            preHandler: [authGuard],
            schema: {
                tags: ["Gems & Wallet"],
                summary: "Get Transaction Status",
                description: "Returns status of a specific transaction for client polling.",
                params: getTransactionParamsSchema,
                response: {
                    200: z.object({
                        success: z.literal(true),
                        data: z.object({
                            transaction_id: z.string().uuid(),
                            payment_status: z.string(),
                            total_gem: z.number(),
                            amount: z.number(),
                            paid_at: z.string().nullable(),
                        }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() }),
                    }),
                    404: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("TRANSACTION_NOT_FOUND"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        getTransactionStatusHandler as any
    );

    // 6. Get Wallet History
    router.get(
        "/api/v1/gems/wallet-history",
        {
            preHandler: [authGuard],
            schema: {
                tags: ["Gems & Wallet"],
                summary: "Get Wallet History",
                description: "Returns paginated list of gem/coin wallet transactions for the caller.",
                querystring: walletHistoryQuerySchema,
                response: {
                    200: z.object({
                        success: z.literal(true),
                        data: z.array(
                            z.object({
                                id: z.string().uuid(),
                                transaction_type: z.string(),
                                coin_change: z.number(),
                                gem_change: z.number(),
                                balance_coin: z.number(),
                                balance_gem: z.number(),
                                note: z.string().nullable(),
                                created_at: z.string(),
                            })
                        ),
                        meta: z.object({
                            page: z.number(),
                            limit: z.number(),
                            total: z.number(),
                            total_pages: z.number(),
                        }),
                    }),
                    401: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("UNAUTHORIZED"), message: z.string() }),
                    }),
                    500: z.object({
                        success: z.boolean(),
                        error: z.object({ code: z.literal("INTERNAL_ERROR"), message: z.string() }),
                    }),
                },
            },
        },
        getWalletHistoryHandler as any
    );
}
