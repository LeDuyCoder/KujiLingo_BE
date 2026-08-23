import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek.js";
import utc from "dayjs/plugin/utc.js";
import { leaderboardRepository } from "./leaderboard.repository.js";
import { memoryCache } from "../../common/utils/cache.js";
import type { GetLeaderboardQuery, PeriodType } from "./leaderboard.types.js";

dayjs.extend(isoWeek);
dayjs.extend(utc);

export const leaderboardService = {
    _resolvePeriodKey(periodType: PeriodType, date: Date = new Date()): string {
        const d = dayjs(date).utc(); // Assuming we use UTC for periods
        switch (periodType) {
            case "daily":
                return d.format("YYYY-MM-DD");
            case "weekly":
                return `${d.isoWeekYear()}-W${d.isoWeek().toString().padStart(2, "0")}`;
            case "monthly":
                return d.format("YYYY-MM");
            case "all_time":
                return "ALL_TIME";
            default:
                return "ALL_TIME";
        }
    },

    async getLeaderboard(query: GetLeaderboardQuery, userId?: string) {
        const periodType = query.period_type || "weekly";
        const limit = query.limit || 50;

        // Resolve current period_key
        const periodKey = this._resolvePeriodKey(periodType);

        // Fetch top entries (limit) from cache or DB
        const cacheKey = `leaderboard:list:${periodType}:${periodKey}:${limit}`;
        let entries = memoryCache.get(cacheKey);

        if (!entries) {
            const snapshots = await leaderboardRepository.findTop(periodType, periodKey, limit);
            entries = snapshots.map((s) => ({
                rank: s.rank,
                user_id: s.user_id,
                display_name: s.display_name,
                avatar_url: s.avatar_url,
                xp_total: s.xp_total,
            }));
            // Cache for 5 minutes (300 seconds)
            memoryCache.set(cacheKey, entries, 300);
        }

        let currentUser = null;

        if (userId) {
            const userSnapshot = await leaderboardRepository.findByUser(userId, periodType, periodKey);
            if (userSnapshot) {
                currentUser = {
                    rank: userSnapshot.rank,
                    xp_total: userSnapshot.xp_total,
                };
            }
        }

        return {
            success: true,
            data: {
                period_type: periodType,
                period_key: periodKey,
                entries,
                current_user: currentUser,
            },
        };
    },
};
