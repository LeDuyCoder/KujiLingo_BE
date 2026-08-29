import { db } from "../../config/prisma.js";
import { v4 as uuidv4 } from "uuid";
import type { RecordMatchDTO } from "./pvp.types.js";

export const pvpRepository = {
    async findStatsByUserId(userId: string) {
        return db.prisma.user_pvp_statistics.findUnique({
            where: { user_id: userId },
        });
    },

    async findUserById(userId: string) {
        return db.prisma.users.findUnique({
            where: { id: userId },
            select: { id: true, display_name: true, avatar: true, status: true },
        });
    },

    async findMatchHistoryByUser(userId: string, skip: number, take: number) {
        return db.prisma.pvp_match_histories.findMany({
            where: {
                OR: [
                    { player1_id: userId },
                    { player2_id: userId },
                ],
            },
            include: {
                users_pvp_match_histories_player1_idTousers: {
                    select: { id: true, display_name: true, avatar: true },
                },
                users_pvp_match_histories_player2_idTousers: {
                    select: { id: true, display_name: true, avatar: true },
                },
            },
            orderBy: {
                played_at: "desc",
            },
            skip,
            take,
        });
    },

    async countMatchHistoryByUser(userId: string) {
        return db.prisma.pvp_match_histories.count({
            where: {
                OR: [
                    { player1_id: userId },
                    { player2_id: userId },
                ],
            },
        });
    },

    async recordMatchTransaction(dto: RecordMatchDTO) {
        const matchId = dto.external_match_id || uuidv4();
        const playedAtDate = new Date(dto.played_at);

        return db.prisma.$transaction(async (tx) => {
            // 1. Insert match history
            const matchRecord = await tx.pvp_match_histories.create({
                data: {
                    id: matchId,
                    player1_id: dto.user_id,
                    player2_id: dto.opponent_id,
                    winner_id: dto.winner_id ?? null,
                    player1_score: dto.user_score ?? 0,
                    player2_score: dto.opponent_score ?? 0,
                    rating_change_player1: dto.rating_change_user ?? 0,
                    rating_change_player2: dto.rating_change_opponent ?? 0,
                    played_at: playedAtDate,
                },
            });

            // Helper to compute wins/losses/draws increment
            const isUserWinner = dto.winner_id === dto.user_id;
            const isOpponentWinner = dto.winner_id === dto.opponent_id;
            const isDraw = !dto.winner_id;

            // 2. Upsert user 1 stats
            const user1Stats = await tx.user_pvp_statistics.findUnique({
                where: { user_id: dto.user_id },
            });

            const user1CurrentRating = user1Stats?.rating ?? 1200;
            const user1RatingChange = dto.rating_change_user ?? 0;
            const user1NewRating = Math.max(0, user1CurrentRating + user1RatingChange);
            const user1HighestRating = Math.max(user1Stats?.highest_rating ?? 1200, user1NewRating);

            const user1Update: any = {
                total_matches: { increment: 1 },
                rating: user1NewRating,
                highest_rating: user1HighestRating,
                updated_at: new Date(),
            };
            if (isUserWinner) user1Update.win_count = { increment: 1 };
            if (isOpponentWinner) user1Update.lose_count = { increment: 1 };
            if (isDraw) user1Update.draw_count = { increment: 1 };

            await tx.user_pvp_statistics.upsert({
                where: { user_id: dto.user_id },
                create: {
                    user_id: dto.user_id,
                    total_matches: 1,
                    win_count: isUserWinner ? 1 : 0,
                    lose_count: isOpponentWinner ? 1 : 0,
                    draw_count: isDraw ? 1 : 0,
                    rating: user1NewRating,
                    highest_rating: user1HighestRating,
                    updated_at: new Date(),
                },
                update: user1Update,
            });

            // 3. Upsert user 2 (opponent) stats
            const user2Stats = await tx.user_pvp_statistics.findUnique({
                where: { user_id: dto.opponent_id },
            });

            const user2CurrentRating = user2Stats?.rating ?? 1200;
            const user2RatingChange = dto.rating_change_opponent ?? 0;
            const user2NewRating = Math.max(0, user2CurrentRating + user2RatingChange);
            const user2HighestRating = Math.max(user2Stats?.highest_rating ?? 1200, user2NewRating);

            const user2Update: any = {
                total_matches: { increment: 1 },
                rating: user2NewRating,
                highest_rating: user2HighestRating,
                updated_at: new Date(),
            };
            if (isOpponentWinner) user2Update.win_count = { increment: 1 };
            if (isUserWinner) user2Update.lose_count = { increment: 1 };
            if (isDraw) user2Update.draw_count = { increment: 1 };

            await tx.user_pvp_statistics.upsert({
                where: { user_id: dto.opponent_id },
                create: {
                    user_id: dto.opponent_id,
                    total_matches: 1,
                    win_count: isOpponentWinner ? 1 : 0,
                    lose_count: isUserWinner ? 1 : 0,
                    draw_count: isDraw ? 1 : 0,
                    rating: user2NewRating,
                    highest_rating: user2HighestRating,
                    updated_at: new Date(),
                },
                update: user2Update,
            });

            return matchRecord;
        });
    },

    async findTopLeaderboard(limit: number) {
        return db.prisma.user_pvp_statistics.findMany({
            where: {
                total_matches: { gte: 1 },
                users: {
                    status: "active",
                },
            },
            include: {
                users: {
                    select: {
                        id: true,
                        display_name: true,
                        avatar: true,
                    },
                },
            },
            orderBy: [
                { rating: "desc" },
                { win_count: "desc" },
            ],
            take: limit,
        });
    },

    async findRankForUser(userId: string) {
        const userStats = await db.prisma.user_pvp_statistics.findUnique({
            where: { user_id: userId },
        });

        if (!userStats || (userStats.total_matches ?? 0) < 1) {
            return null;
        }

        const callerRating = userStats.rating ?? 1200;
        const callerWins = userStats.win_count ?? 0;

        const higherCount = await db.prisma.user_pvp_statistics.count({
            where: {
                total_matches: { gte: 1 },
                users: {
                    status: "active",
                },
                OR: [
                    { rating: { gt: callerRating } },
                    {
                        rating: callerRating,
                        win_count: { gt: callerWins },
                    },
                ],
            },
        });

        return {
            rank: higherCount + 1,
            rating: callerRating,
            total_matches: userStats.total_matches ?? 0,
        };
    },
};
