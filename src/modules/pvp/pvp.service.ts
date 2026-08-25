import { pvpRepository } from "./pvp.repository.js";
import type {
    GetMatchHistoryQuery,
    RecordMatchDTO,
    UserPVPStatsResponse,
    MatchHistoryEntry,
    LeaderboardEntry,
} from "./pvp.types.js";

export class PVPError extends Error {
    constructor(
        public statusCode: number,
        public code: string,
        message: string
    ) {
        super(message);
        this.name = "PVPError";
    }
}

export const pvpService = {
    async getMyStatistics(userId: string): Promise<UserPVPStatsResponse> {
        const stats = await pvpRepository.findStatsByUserId(userId);

        if (!stats || !stats.total_matches || stats.total_matches === 0) {
            return {
                total_matches: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                win_rate: null,
                rating: stats?.rating ?? 1200,
                highest_rating: stats?.highest_rating ?? 1200,
            };
        }

        const totalMatches = stats.total_matches ?? 0;
        const wins = stats.win_count ?? 0;
        const losses = stats.lose_count ?? 0;
        const draws = stats.draw_count ?? 0;
        const winRate = totalMatches > 0 ? Number(((wins / totalMatches) * 100).toFixed(1)) : null;

        return {
            total_matches: totalMatches,
            wins,
            losses,
            draws,
            win_rate: winRate,
            rating: stats.rating ?? 1200,
            highest_rating: stats.highest_rating ?? 1200,
        };
    },

    async getMatchHistory(userId: string, query: GetMatchHistoryQuery) {
        const page = Math.max(1, query.page ?? 1);
        const limit = Math.min(50, Math.max(1, query.limit ?? 20));
        const filterResult = query.result;

        if (filterResult) {
            // Fetch all matches for the user to filter accurately by perspective
            const allRawMatches = await pvpRepository.findMatchHistoryByUser(userId, 0, 1000);

            const mappedAll = allRawMatches.map((match) => this.mapMatchToPerspective(userId, match));
            const filteredMatches = mappedAll.filter((match) => match.result === filterResult);

            const total = filteredMatches.length;
            const totalPages = Math.ceil(total / limit) || 1;
            const startIndex = (page - 1) * limit;
            const paginatedMatches = filteredMatches.slice(startIndex, startIndex + limit);

            return {
                data: paginatedMatches,
                meta: {
                    page,
                    limit,
                    total,
                    total_pages: totalPages,
                },
            };
        }

        const skip = (page - 1) * limit;
        const [rawMatches, total] = await Promise.all([
            pvpRepository.findMatchHistoryByUser(userId, skip, limit),
            pvpRepository.countMatchHistoryByUser(userId),
        ]);

        const mappedMatches = rawMatches.map((match) => this.mapMatchToPerspective(userId, match));
        const totalPages = Math.ceil(total / limit) || 1;

        return {
            data: mappedMatches,
            meta: {
                page,
                limit,
                total,
                total_pages: totalPages,
            },
        };
    },

    async recordMatch(dto: RecordMatchDTO) {
        // Validate users exist
        const [user1Exists, user2Exists] = await Promise.all([
            pvpRepository.findUserById(dto.user_id),
            pvpRepository.findUserById(dto.opponent_id),
        ]);

        if (!user1Exists || !user2Exists) {
            const missingId = !user1Exists ? dto.user_id : dto.opponent_id;
            throw new PVPError(422, "USER_NOT_FOUND", `User with ID ${missingId} does not exist.`);
        }

        const match = await pvpRepository.recordMatchTransaction(dto);
        return { match_id: match.id };
    },

    async getLeaderboard(userId: string, limit: number = 50) {
        const cappedLimit = Math.min(100, Math.max(1, limit));

        const [topRows, callerRankInfo] = await Promise.all([
            pvpRepository.findTopLeaderboard(cappedLimit),
            pvpRepository.findRankForUser(userId),
        ]);

        const entries: LeaderboardEntry[] = topRows.map((row, index) => {
            const totalMatches = row.total_matches ?? 0;
            const wins = row.win_count ?? 0;
            const winRate = totalMatches > 0 ? Number(((wins / totalMatches) * 100).toFixed(1)) : null;

            return {
                rank: index + 1,
                user_id: row.user_id,
                display_name: row.users?.display_name || "Player",
                avatar: row.users?.avatar || null,
                rating: row.rating ?? 1200,
                wins,
                total_matches: totalMatches,
                win_rate: winRate,
            };
        });

        const currentUser = callerRankInfo
            ? {
                  rank: callerRankInfo.rank,
                  rating: callerRankInfo.rating,
                  total_matches: callerRankInfo.total_matches,
              }
            : null;

        return {
            entries,
            current_user: currentUser,
        };
    },

    mapMatchToPerspective(userId: string, match: any): MatchHistoryEntry {
        const isPlayer1 = match.player1_id === userId;
        const opponentUser = isPlayer1
            ? match.users_pvp_match_histories_player2_idTousers
            : match.users_pvp_match_histories_player1_idTousers;

        const opponentId = isPlayer1 ? match.player2_id : match.player1_id;

        let result: "WIN" | "LOSS" | "DRAW" = "DRAW";
        if (match.winner_id === userId) {
            result = "WIN";
        } else if (match.winner_id && match.winner_id !== userId) {
            result = "LOSS";
        }

        const playerScore = isPlayer1 ? (match.player1_score ?? 0) : (match.player2_score ?? 0);
        const opponentScore = isPlayer1 ? (match.player2_score ?? 0) : (match.player1_score ?? 0);
        const ratingChange = isPlayer1 ? (match.rating_change_player1 ?? 0) : (match.rating_change_player2 ?? 0);

        return {
            id: match.id,
            opponent_id: opponentId,
            opponent_name: opponentUser?.display_name || "Unknown Opponent",
            opponent_avatar: opponentUser?.avatar || null,
            result,
            score: {
                player: playerScore,
                opponent: opponentScore,
            },
            rating_change: ratingChange,
            played_at: match.played_at ? match.played_at.toISOString() : new Date().toISOString(),
        };
    },
};
