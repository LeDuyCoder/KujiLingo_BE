import { log } from "../../common/utils/log.js";
import { gemsRepository } from "./gems.repository.js";
import { payOSAdapter } from "./payos.client.js";
import type {
    GetWalletHistoryQuery,
    ListGemPackagesResponse,
    GetActivePromotionResponse,
    CreateTransactionResponse,
    GetTransactionStatusResponse,
    GetWalletHistoryResponse,
} from "./gems.types.js";

function generateTransactionCode(): string {
    const timestamp = Date.now();
    const randomHex = Math.random().toString(16).substring(2, 8).toUpperCase();
    return `KL-${timestamp}-${randomHex}`;
}

function generateOrderCode(): number {
    const tsStr = Date.now().toString(); // 13 digits
    const suffix = Math.floor(100 + Math.random() * 899).toString(); // 3 digits
    return parseInt(`${tsStr.slice(-10)}${suffix}`, 10);
}

export const gemsService = {
    /**
     * 1. List Gem Packages
     */
    async listPackages(): Promise<ListGemPackagesResponse> {
        const [packages, activePromotion] = await Promise.all([
            gemsRepository.findActivePackages(),
            gemsRepository.findActivePromotion(),
        ]);

        const bonusPercent = activePromotion?.bonus_percent ?? 0;

        const packageDTOs = packages.map((pkg) => {
            const gemAmount = pkg.gem_amount ?? 0;
            const baseBonus = pkg.bonus_gem ?? 0;
            const promoBonus = bonusPercent > 0 ? Math.floor((gemAmount * bonusPercent) / 100) : 0;
            const effectiveBonusGem = baseBonus + promoBonus;
            const totalGems = gemAmount + effectiveBonusGem;

            return {
                id: pkg.id,
                title: pkg.title ?? "",
                gem_amount: gemAmount,
                bonus_gem: baseBonus,
                effective_bonus_gem: effectiveBonusGem,
                total_gems: totalGems,
                price: Number(pkg.price ?? 0),
                image: pkg.image,
                is_popular: pkg.is_popular ?? false,
                is_best_value: pkg.is_best_value ?? false,
            };
        });

        return {
            success: true,
            data: {
                packages: packageDTOs,
                active_promotion: activePromotion
                    ? {
                          id: activePromotion.id,
                          title: activePromotion.title ?? "",
                          bonus_percent: activePromotion.bonus_percent ?? 0,
                          end_at: activePromotion.end_at ? activePromotion.end_at.toISOString() : "",
                      }
                    : null,
            },
        };
    },

    /**
     * 2. Get Active Promotion
     */
    async getActivePromotion(): Promise<GetActivePromotionResponse> {
        const promo = await gemsRepository.findActivePromotion();
        return {
            success: true,
            data: promo
                ? {
                      id: promo.id,
                      title: promo.title ?? "",
                      description: promo.description ?? null,
                      bonus_percent: promo.bonus_percent ?? 0,
                      start_at: promo.start_at ? promo.start_at.toISOString() : "",
                      end_at: promo.end_at ? promo.end_at.toISOString() : "",
                  }
                : null,
        };
    },

    /**
     * 3. Create Payment Transaction (Initiate Recharge)
     */
    async createTransaction(
        userId: string,
        userEmail: string,
        packageId: string,
        buyerEmail?: string
    ): Promise<CreateTransactionResponse> {
        const pkg = await gemsRepository.findActivePackageById(packageId);
        if (!pkg) {
            throw new Error("INVALID_PACKAGE");
        }

        const activePromotion = await gemsRepository.findActivePromotion();

        const gemAmount = pkg.gem_amount ?? 0;
        const baseBonusGem = pkg.bonus_gem ?? 0;
        const bonusPercent = activePromotion?.bonus_percent ?? 0;
        const promoBonus = bonusPercent > 0 ? Math.floor((gemAmount * bonusPercent) / 100) : 0;
        const totalBonusGem = baseBonusGem + promoBonus;
        const totalGem = gemAmount + totalBonusGem;
        const amount = Number(pkg.price ?? 0);

        const transactionCode = generateTransactionCode();
        const orderCode = generateOrderCode();
        const expiredAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        // Persistent transaction insertion before PayOS call
        const pendingTx = await gemsRepository.createPendingTransaction({
            userId,
            packageId: pkg.id,
            promotionId: activePromotion?.id ?? null,
            transactionCode,
            orderCode,
            amount,
            gemAmount,
            bonusGem: totalBonusGem,
            totalGem,
            expiredAt,
        });

        const frontendUrl = process.env.FRONTEND_URL || "https://kujilingo.com";
        const returnUrl = `${frontendUrl}/gems/return`;
        const cancelUrl = `${frontendUrl}/gems/cancel`;

        try {
            const payOSResult = await payOSAdapter.createPaymentLink({
                orderCode,
                amount,
                description: "KujiLingo gems",
                buyerEmail: buyerEmail || userEmail,
                returnUrl,
                cancelUrl,
                expiredAt: Math.floor(expiredAt.getTime() / 1000),
            });

            await gemsRepository.updateTransactionCheckoutDetails(
                pendingTx.id,
                payOSResult.checkoutUrl,
                payOSResult.qrCode,
                payOSResult.paymentLinkId
            );

            return {
                success: true,
                data: {
                    transaction_id: pendingTx.id,
                    transaction_code: transactionCode,
                    order_code: orderCode,
                    payment_url: payOSResult.checkoutUrl,
                    qr_code: payOSResult.qrCode,
                    amount,
                    gem_amount: gemAmount,
                    bonus_gem: totalBonusGem,
                    total_gem: totalGem,
                    expired_at: expiredAt.toISOString(),
                },
                message:
                    "Payment initiated. Redirect the user to payment_url, or render qr_code for in-app bank-transfer checkout.",
            };
        } catch (error: any) {
            log.error("PayOS Payment Creation Failed:", error);
            await gemsRepository.updateTransactionStatus(pendingTx.id, "FAILED");
            throw new Error("PAYMENT_GATEWAY_ERROR");
        }
    },

    /**
     * 4. Payment Callback (Webhook)
     */
    async handlePayOSCallback(body: any): Promise<{ success: true }> {
        let verifiedData: any;
        try {
            verifiedData = await payOSAdapter.verifyWebhook(body);
        } catch (err: any) {
            log.error("PayOS Webhook Signature Verification Failed:", err);
            throw new Error("INVALID_SIGNATURE");
        }

        const webhookEnvelope = body;
        const callbackData = verifiedData || webhookEnvelope.data;

        if (!callbackData || typeof callbackData.orderCode !== "number") {
            throw new Error("INVALID_PAYLOAD");
        }

        const orderCode = callbackData.orderCode;
        const tx = await gemsRepository.findByOrderCode(orderCode);

        if (!tx) {
            log.warn(`Webhook received for non-existent orderCode: ${orderCode}`);
            throw new Error("TRANSACTION_NOT_FOUND");
        }

        // Idempotency: Ignore if already finalized
        if (
            tx.payment_status === "SUCCESS" ||
            tx.payment_status === "FAILED" ||
            tx.payment_status === "CANCELLED" ||
            tx.payment_status === "EXPIRED"
        ) {
            log.info(`Transaction ${tx.id} (orderCode ${orderCode}) already finalized as ${tx.payment_status}`);
            return { success: true };
        }

        const isSuccess =
            (webhookEnvelope.code === "00" || callbackData.code === "00") &&
            (webhookEnvelope.success === true || callbackData.success !== false);

        if (isSuccess) {
            const packageTitle = tx.gem_packages?.title || "Gem Package";
            await gemsRepository.fulfillSuccessfulPayment({
                transactionId: tx.id,
                userId: tx.user_id!,
                totalGem: tx.total_gem ?? 0,
                providerReference: callbackData.reference || webhookEnvelope.desc,
                note: `Purchased ${packageTitle}`,
            });
            log.info(`Successfully credited ${tx.total_gem} gems to user ${tx.user_id}`);
        } else {
            await gemsRepository.updateTransactionStatus(tx.id, "FAILED");
            log.info(`Marked transaction ${tx.id} as FAILED due to non-success webhook`);
        }

        return { success: true };
    },

    /**
     * 5. Get Transaction Status
     */
    async getTransactionStatus(transactionId: string, userId: string): Promise<GetTransactionStatusResponse> {
        const tx = await gemsRepository.findByIdAndUser(transactionId, userId);
        if (!tx) {
            throw new Error("TRANSACTION_NOT_FOUND");
        }

        let currentStatus = tx.payment_status ?? "PENDING";
        let paidAt = tx.paid_at;

        if (currentStatus === "PENDING") {
            const now = new Date();
            if (tx.expired_at && now > tx.expired_at) {
                currentStatus = "EXPIRED";
                await gemsRepository.updateTransactionStatus(tx.id, "EXPIRED");
            } else if (tx.provider_transaction_id) {
                // Optional freshness enhancement: actively poll PayOS API if pending
                try {
                    const payOSInfo = await payOSAdapter.getPaymentLinkInfo(tx.provider_transaction_id);
                    if (payOSInfo && (payOSInfo.status === "PAID" || payOSInfo.code === "00")) {
                        await gemsRepository.fulfillSuccessfulPayment({
                            transactionId: tx.id,
                            userId,
                            totalGem: tx.total_gem ?? 0,
                            providerReference: payOSInfo.reference || "POLL_RECONCILED",
                            note: "Purchased Gem Package",
                        });
                        currentStatus = "SUCCESS";
                        paidAt = new Date();
                    }
                } catch (pollErr) {
                    log.warn(`Freshness status poll failed for tx ${tx.id}:`, pollErr);
                }
            }
        }

        return {
            success: true,
            data: {
                transaction_id: tx.id,
                payment_status: currentStatus,
                total_gem: tx.total_gem ?? 0,
                amount: Number(tx.amount ?? 0),
                paid_at: paidAt ? paidAt.toISOString() : null,
            },
        };
    },

    /**
     * 6. Get Wallet History
     */
    async getWalletHistory(userId: string, query: GetWalletHistoryQuery): Promise<GetWalletHistoryResponse> {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;

        const { items, total } = await gemsRepository.findWalletHistoryByUser(
            userId,
            query.transaction_type,
            page,
            limit
        );

        const data = items.map((item) => ({
            id: item.id,
            transaction_type: item.transaction_type ?? "RECHARGE",
            coin_change: item.coin_change ?? 0,
            gem_change: item.gem_change ?? 0,
            balance_coin: item.balance_coin ?? 0,
            balance_gem: item.balance_gem ?? 0,
            note: item.note,
            created_at: item.created_at ? item.created_at.toISOString() : new Date().toISOString(),
        }));

        const totalPages = Math.ceil(total / limit) || 1;

        return {
            success: true,
            data,
            meta: {
                page,
                limit,
                total,
                total_pages: totalPages,
            },
        };
    },
};
