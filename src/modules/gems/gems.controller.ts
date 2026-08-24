import type { FastifyReply, FastifyRequest } from "fastify";
import { gemsService } from "./gems.service.js";
import { log } from "../../common/utils/log.js";
import type { CreateTransactionBody, GetTransactionParams, GetWalletHistoryQuery } from "./gems.types.js";

/**
 * 1. List Gem Packages
 */
export async function listPackagesHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const result = await gemsService.listPackages();
        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);
        return reply.code(500).send({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred. Please try again later.",
            },
        });
    }
}

/**
 * 2. Get Active Promotion
 */
export async function getActivePromotionHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const result = await gemsService.getActivePromotion();
        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);
        return reply.code(500).send({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred. Please try again later.",
            },
        });
    }
}

/**
 * 3. Create Payment Transaction (Initiate Recharge)
 */
export async function createTransactionHandler(
    request: FastifyRequest<{ Body: CreateTransactionBody }>,
    reply: FastifyReply
) {
    try {
        const userId = request.user!.id;
        const userEmail = (request as any).user?.email || "";
        const { package_id, buyer_email } = request.body;

        const result = await gemsService.createTransaction(userId, userEmail, package_id, buyer_email);
        return reply.code(201).send(result);
    } catch (error: any) {
        log.error(error);

        if (error.message === "INVALID_PACKAGE") {
            return reply.code(422).send({
                success: false,
                error: {
                    code: "INVALID_PACKAGE",
                    message: "Package not found or is inactive.",
                },
            });
        }

        if (error.message === "PAYMENT_GATEWAY_ERROR") {
            return reply.code(500).send({
                success: false,
                error: {
                    code: "PAYMENT_GATEWAY_ERROR",
                    message: "PayOS gateway error or service unreachable.",
                },
            });
        }

        return reply.code(500).send({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred. Please try again later.",
            },
        });
    }
}

/**
 * 4. Payment Callback (Webhook)
 */
export async function payosCallbackHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const result = await gemsService.handlePayOSCallback(request.body);
        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);

        if (error.message === "INVALID_SIGNATURE") {
            return reply.code(400).send({
                success: false,
                error: {
                    code: "INVALID_SIGNATURE",
                    message: "PayOS webhook signature verification failed.",
                },
            });
        }

        if (error.message === "TRANSACTION_NOT_FOUND") {
            return reply.code(404).send({
                success: false,
                error: {
                    code: "TRANSACTION_NOT_FOUND",
                    message: "No transaction found matching the given orderCode.",
                },
            });
        }

        return reply.code(400).send({
            success: false,
            error: {
                code: "BAD_REQUEST",
                message: error.message || "Callback processing failed.",
            },
        });
    }
}

/**
 * 5. Get Transaction Status
 */
export async function getTransactionStatusHandler(
    request: FastifyRequest<{ Params: GetTransactionParams }>,
    reply: FastifyReply
) {
    try {
        const userId = request.user!.id;
        const { transactionId } = request.params;

        const result = await gemsService.getTransactionStatus(transactionId, userId);
        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);

        if (error.message === "TRANSACTION_NOT_FOUND") {
            return reply.code(404).send({
                success: false,
                error: {
                    code: "TRANSACTION_NOT_FOUND",
                    message: "Transaction not found or access denied.",
                },
            });
        }

        return reply.code(500).send({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred. Please try again later.",
            },
        });
    }
}

/**
 * 6. Get Wallet History
 */
export async function getWalletHistoryHandler(
    request: FastifyRequest<{ Querystring: GetWalletHistoryQuery }>,
    reply: FastifyReply
) {
    try {
        const userId = request.user!.id;
        const result = await gemsService.getWalletHistory(userId, request.query);
        return reply.code(200).send(result);
    } catch (error: any) {
        log.error(error);
        return reply.code(500).send({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred. Please try again later.",
            },
        });
    }
}
