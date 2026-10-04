import crypto from "node:crypto";
import { db } from "../../config/prisma.js";
import { hasActivePremium } from "../../common/utils/premium.js";

const plans = {
    monthly: { price: 199, months: 1 },
    yearly: { price: 1990, months: 12 },
} as const;

export const premiumService = {
    async purchase(userId: string, planName: keyof typeof plans) {
        const plan = plans[planName];
        if (!plan) throw new Error("INVALID_PLAN");

        return db.prisma.$transaction(async (tx) => {
            await tx.user_wallets.createMany({
                data: [{ user_id: userId, coins: 0, gems: 0, updated_at: new Date() }],
                skipDuplicates: true,
            });
            const rows = await tx.$queryRaw<Array<{ coins: number | null; gems: number | null }>>`
                SELECT "coins", "gems" FROM "user_wallets" WHERE "user_id" = ${userId}::uuid FOR UPDATE
            `;
            const wallet = rows[0];
            const gems = wallet?.gems ?? 0;
            if (gems < plan.price) throw new Error("INSUFFICIENT_GEMS");

            const now = new Date();
            const user = await tx.users.findUnique({
                where: { id: userId },
                select: { premium_expires_at: true },
            });
            if (!user) throw new Error("USER_NOT_FOUND");

            const expiresAt = new Date(Math.max(now.getTime(), user.premium_expires_at?.getTime() ?? 0));
            const preferredDay = expiresAt.getDate();
            expiresAt.setDate(1);
            expiresAt.setMonth(expiresAt.getMonth() + plan.months);
            const lastDayOfTargetMonth = new Date(expiresAt.getFullYear(), expiresAt.getMonth() + 1, 0).getDate();
            expiresAt.setDate(Math.min(preferredDay, lastDayOfTargetMonth));
            const updatedWallet = await tx.user_wallets.update({
                where: { user_id: userId },
                data: { gems: gems - plan.price, updated_at: now },
            });
            await tx.users.update({ where: { id: userId }, data: { premium_expires_at: expiresAt } });
            await tx.wallet_histories.create({
                data: {
                    id: crypto.randomUUID(),
                    user_id: userId,
                    transaction_type: "PURCHASE",
                    coin_change: 0,
                    gem_change: -plan.price,
                    balance_coin: wallet?.coins ?? 0,
                    balance_gem: updatedWallet.gems ?? gems - plan.price,
                    note: `KujiLingo Pro ${planName} plan`,
                    created_at: now,
                },
            });

            return {
                is_premium: true,
                premium_expires_at: expiresAt.toISOString(),
                gems_remaining: updatedWallet.gems ?? gems - plan.price,
            };
        });
    },

    hasActivePremium,
};
