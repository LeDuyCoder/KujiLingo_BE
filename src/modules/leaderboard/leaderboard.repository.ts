import { db } from "../../config/prisma.js";
import type { PeriodType } from "./leaderboard.types.js";

export const leaderboardRepository = {
    async findTop(periodType: PeriodType, periodKey: string, limit: number) {
        return db.prisma.leaderboard_snapshots.findMany({
            where: {
                period_type: periodType as any, // Prisma enum matches our union
                period_key: periodKey,
            },
            orderBy: {
                rank: "asc",
            },
            take: limit,
        });
    },

    async findByUser(userId: string, periodType: PeriodType, periodKey: string) {
        return db.prisma.leaderboard_snapshots.findFirst({
            where: {
                user_id: userId,
                period_type: periodType as any,
                period_key: periodKey,
            },
        });
    },
};
