export type PeriodType = "daily" | "weekly" | "monthly" | "all_time";

export interface GetLeaderboardQuery {
    period_type?: PeriodType;
    limit?: number;
}

export interface LeaderboardEntry {
    rank: number;
    user_id: string;
    display_name: string | null;
    avatar_url: string | null;
    xp_total: number;
}

export interface CurrentUserLeaderboard {
    rank: number;
    xp_total: number;
}
