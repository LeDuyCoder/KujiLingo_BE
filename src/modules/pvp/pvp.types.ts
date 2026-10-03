export type MatchResultFilter = "WIN" | "LOSS" | "DRAW";

export interface GetMatchHistoryQuery {
    result?: MatchResultFilter | undefined;
    page?: number | undefined;
    limit?: number | undefined;
}

export interface RecordMatchDTO {
    user_id: string;
    opponent_id: string;
    winner_id?: string | null | undefined;
    user_score?: number | undefined;
    opponent_score?: number | undefined;
    rating_change_user?: number | undefined;
    rating_change_opponent?: number | undefined;
    played_at: string;
    external_match_id?: string | undefined;
}

export interface GetLeaderboardQuery {
    limit?: number | undefined;
}

export interface UserPVPStatsResponse {
    total_matches: number;
    wins: number;
    losses: number;
    draws: number;
    win_rate: number | null;
    rating: number;
    highest_rating: number;
}

export interface MatchHistoryEntry {
    id: string;
    opponent_id: string;
    opponent_name: string;
    opponent_avatar: string | null;
    result: "WIN" | "LOSS" | "DRAW";
    score: {
        player: number;
        opponent: number;
    };
    rating_change: number;
    played_at: Date | string;
}

export interface LeaderboardEntry {
    rank: number;
    user_id: string;
    display_name: string;
    avatar: string | null;
    rating: number;
    wins: number;
    total_matches: number;
    win_rate: number | null;
}
