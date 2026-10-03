import { test, mock, beforeEach } from "node:test";
import assert from "node:assert";
import { pvpService, PVPError } from "../../src/modules/pvp/pvp.service.js";
import { pvpRepository } from "../../src/modules/pvp/pvp.repository.js";

test("PVP Service - Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
    });

    await t.test("getMyStatistics - returns zeroed defaults for user with no matches", async () => {
        mock.method(pvpRepository, "findStatsByUserId", async () => null);

        const stats = await pvpService.getMyStatistics("user-1");

        assert.strictEqual(stats.total_matches, 0);
        assert.strictEqual(stats.wins, 0);
        assert.strictEqual(stats.losses, 0);
        assert.strictEqual(stats.draws, 0);
        assert.strictEqual(stats.win_rate, null);
        assert.strictEqual(stats.rating, 1200);
        assert.strictEqual(stats.highest_rating, 1200);
    });

    await t.test("getMyStatistics - calculates win_rate correctly for user with matches", async () => {
        mock.method(pvpRepository, "findStatsByUserId", async () => ({
            user_id: "user-1",
            total_matches: 42,
            win_count: 28,
            lose_count: 12,
            draw_count: 2,
            rating: 1350,
            highest_rating: 1410,
            total_score: 300,
            average_score: 7.1,
            longest_win_streak: 5,
            current_win_streak: 2,
            updated_at: new Date(),
        }));

        const stats = await pvpService.getMyStatistics("user-1");

        assert.strictEqual(stats.total_matches, 42);
        assert.strictEqual(stats.wins, 28);
        assert.strictEqual(stats.losses, 12);
        assert.strictEqual(stats.draws, 2);
        assert.strictEqual(stats.win_rate, 66.7);
        assert.strictEqual(stats.rating, 1350);
        assert.strictEqual(stats.highest_rating, 1410);
    });

    await t.test("getMatchHistory - maps match perspective correctly when caller is player 1", async () => {
        const mockRawMatch = {
            id: "match-1",
            player1_id: "user-1",
            player2_id: "user-2",
            winner_id: "user-1",
            player1_score: 8,
            player2_score: 5,
            rating_change_player1: 15,
            rating_change_player2: -15,
            played_at: new Date("2026-08-04T10:30:00.000Z"),
            users_pvp_match_histories_player1_idTousers: { id: "user-1", display_name: "Me", avatar: null },
            users_pvp_match_histories_player2_idTousers: { id: "user-2", display_name: "Minh", avatar: "avatar.jpg" },
        };

        mock.method(pvpRepository, "findMatchHistoryByUser", async () => [mockRawMatch]);
        mock.method(pvpRepository, "countMatchHistoryByUser", async () => 1);

        const res = await pvpService.getMatchHistory("user-1", { page: 1, limit: 20 });

        assert.strictEqual(res.data.length, 1);
        assert.strictEqual(res.data[0].id, "match-1");
        assert.strictEqual(res.data[0].opponent_id, "user-2");
        assert.strictEqual(res.data[0].opponent_name, "Minh");
        assert.strictEqual(res.data[0].opponent_avatar, "avatar.jpg");
        assert.strictEqual(res.data[0].result, "WIN");
        assert.strictEqual(res.data[0].score.player, 8);
        assert.strictEqual(res.data[0].score.opponent, 5);
        assert.strictEqual(res.data[0].rating_change, 15);
    });

    await t.test("getMatchHistory - inverts result when caller is player 2 (opponent won)", async () => {
        const mockRawMatch = {
            id: "match-2",
            player1_id: "user-2",
            player2_id: "user-1",
            winner_id: "user-2",
            player1_score: 10,
            player2_score: 4,
            rating_change_player1: 20,
            rating_change_player2: -20,
            played_at: new Date("2026-08-04T11:00:00.000Z"),
            users_pvp_match_histories_player1_idTousers: { id: "user-2", display_name: "Opponent", avatar: null },
            users_pvp_match_histories_player2_idTousers: { id: "user-1", display_name: "Me", avatar: null },
        };

        mock.method(pvpRepository, "findMatchHistoryByUser", async () => [mockRawMatch]);
        mock.method(pvpRepository, "countMatchHistoryByUser", async () => 1);

        const res = await pvpService.getMatchHistory("user-1", { page: 1, limit: 20 });

        assert.strictEqual(res.data.length, 1);
        assert.strictEqual(res.data[0].opponent_id, "user-2");
        assert.strictEqual(res.data[0].result, "LOSS");
        assert.strictEqual(res.data[0].score.player, 4);
        assert.strictEqual(res.data[0].score.opponent, 10);
        assert.strictEqual(res.data[0].rating_change, -20);
    });

    await t.test("recordMatch - throws PVPError 422 if either user does not exist", async () => {
        mock.method(pvpRepository, "findUserById", async (id: string) => {
            if (id === "user-1") return { id: "user-1", display_name: "U1", avatar: null, status: "active" };
            return null;
        });

        await assert.rejects(
            async () => {
                await pvpService.recordMatch({
                    user_id: "user-1",
                    opponent_id: "non-existent-user",
                    winner_id: "user-1",
                    played_at: new Date().toISOString(),
                });
            },
            (err: any) => {
                assert.ok(err instanceof PVPError);
                assert.strictEqual(err.statusCode, 422);
                assert.strictEqual(err.code, "USER_NOT_FOUND");
                return true;
            }
        );
    });

    await t.test("getLeaderboard - returns top ranked users and current user rank", async () => {
        const mockTop = [
            {
                user_id: "user-top-1",
                total_matches: 50,
                win_count: 35,
                rating: 1450,
                users: { display_name: "Minh", avatar: null },
            },
        ];
        const mockCallerRank = { rank: 28, rating: 1200, total_matches: 15 };

        mock.method(pvpRepository, "findTopLeaderboard", async () => mockTop);
        mock.method(pvpRepository, "findRankForUser", async () => mockCallerRank);

        const res = await pvpService.getLeaderboard("caller-id", 50);

        assert.strictEqual(res.entries.length, 1);
        assert.strictEqual(res.entries[0].rank, 1);
        assert.strictEqual(res.entries[0].display_name, "Minh");
        assert.strictEqual(res.entries[0].rating, 1450);
        assert.strictEqual(res.entries[0].win_rate, 70.0);
        assert.deepStrictEqual(res.current_user, { rank: 28, rating: 1200, total_matches: 15 });
    });
});
