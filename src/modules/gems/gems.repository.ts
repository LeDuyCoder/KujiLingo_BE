import { prisma } from "../../config/prisma.js";
import { v4 as uuidv4 } from "uuid";
import type { PaymentStatus, WalletTransactionType } from "../../../generated/prisma/client.js";

export const gemsRepository = {
    /**
     * Find active gem packages sorted by sort_order ASC
     */
    async findActivePackages() {
        return prisma.gem_packages.findMany({
            where: { is_active: true },
            orderBy: { sort_order: "asc" },
        });
    },

    /**
     * Find at most one current active promotion (highest bonus_percent if overlapping)
     */
    async findActivePromotion() {
        const now = new Date();
        return prisma.gem_promotions.findFirst({
            where: {
                is_active: true,
                start_at: { lte: now },
                end_at: { gte: now },
            },
            orderBy: { bonus_percent: "desc" },
        });
    },

    /**
     * Find active package by ID
     */
    async findActivePackageById(packageId: string) {
        return prisma.gem_packages.findFirst({
            where: {
                id: packageId,
                is_active: true,
            },
        });
    },

    /**
     * Create payment_transactions record (status: PENDING)
     */
    async createPendingTransaction(data: {
        userId: string;
        packageId: string;
        promotionId?: string | null;
        transactionCode: string;
        orderCode: number;
        amount: number;
        gemAmount: number;
        bonusGem: number;
        totalGem: number;
        expiredAt: Date;
    }) {
        return prisma.payment_transactions.create({
            data: {
                id: uuidv4(),
                user_id: data.userId,
                package_id: data.packageId,
                promotion_id: data.promotionId ?? null,
                payment_method: "PAYOS",
                payment_status: "PENDING",
                amount: data.amount,
                gem_amount: data.gemAmount,
                bonus_gem: data.bonusGem,
                total_gem: data.totalGem,
                transaction_code: data.transactionCode,
                order_code: BigInt(data.orderCode),
                expired_at: data.expiredAt,
                created_at: new Date(),
            },
        });
    },

    /**
     * Update payment transaction with checkout details from PayOS
     */
    async updateTransactionCheckoutDetails(
        transactionId: string,
        checkoutUrl: string,
        qrCode: string,
        paymentLinkId: string
    ) {
        return prisma.payment_transactions.update({
            where: { id: transactionId },
            data: {
                payment_url: checkoutUrl,
                qr_code: qrCode,
                provider_transaction_id: paymentLinkId,
                updated_at: new Date(),
            },
        });
    },

    /**
     * Update transaction status
     */
    async updateTransactionStatus(transactionId: string, status: PaymentStatus) {
        return prisma.payment_transactions.update({
            where: { id: transactionId },
            data: {
                payment_status: status,
                updated_at: new Date(),
            },
        });
    },

    /**
     * Find payment transaction by numeric order_code
     */
    async findByOrderCode(orderCode: number) {
        return prisma.payment_transactions.findUnique({
            where: { order_code: BigInt(orderCode) },
            include: {
                gem_packages: true,
            },
        });
    },

    /**
     * Find payment transaction by ID and userId
     */
    async findByIdAndUser(transactionId: string, userId: string) {
        return prisma.payment_transactions.findFirst({
            where: {
                id: transactionId,
                user_id: userId,
            },
        });
    },

    /**
     * Execute atomic database transaction for successful payment:
     * 1. Update payment_transactions (status=SUCCESS, paid_at, provider_reference)
     * 2. Upsert user_wallets (increment gems)
     * 3. Insert wallet_histories
     */
    async fulfillSuccessfulPayment(data: {
        transactionId: string;
        userId: string;
        totalGem: number;
        providerReference?: string;
        note?: string;
    }) {
        return prisma.$transaction(async (tx) => {
            const now = new Date();

            // 1. Update payment transaction
            const updatedTx = await tx.payment_transactions.update({
                where: { id: data.transactionId },
                data: {
                    payment_status: "SUCCESS",
                    paid_at: now,
                    provider_response: data.providerReference ?? null,
                    updated_at: now,
                },
            });

            // 2. Upsert user_wallet
            const existingWallet = await tx.user_wallets.findUnique({
                where: { user_id: data.userId },
            });

            const currentCoins = existingWallet?.coins ?? 0;
            const currentGems = existingWallet?.gems ?? 0;
            const newGems = currentGems + data.totalGem;

            const updatedWallet = await tx.user_wallets.upsert({
                where: { user_id: data.userId },
                update: {
                    gems: { increment: data.totalGem },
                    updated_at: now,
                },
                create: {
                    user_id: data.userId,
                    coins: 0,
                    gems: data.totalGem,
                    updated_at: now,
                },
            });

            // 3. Insert wallet_histories
            const history = await tx.wallet_histories.create({
                data: {
                    id: uuidv4(),
                    user_id: data.userId,
                    transaction_type: "RECHARGE",
                    coin_change: 0,
                    gem_change: data.totalGem,
                    balance_coin: currentCoins,
                    balance_gem: updatedWallet.gems ?? newGems,
                    payment_transaction_id: data.transactionId,
                    note: data.note ?? "Recharge gems",
                    created_at: now,
                },
            });

            return { updatedTx, updatedWallet, history };
        });
    },

    /**
     * Find wallet history by user ID with optional filtering and pagination
     */
    async findWalletHistoryByUser(
        userId: string,
        transactionType?: WalletTransactionType,
        page: number = 1,
        limit: number = 20
    ) {
        const whereClause: any = { user_id: userId };
        if (transactionType) {
            whereClause.transaction_type = transactionType;
        }

        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            prisma.wallet_histories.findMany({
                where: whereClause,
                orderBy: { created_at: "desc" },
                skip,
                take: limit,
            }),
            prisma.wallet_histories.count({
                where: whereClause,
            }),
        ]);

        return { items, total };
    },
};
