import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { leaderboardService } from "../../src/modules/leaderboard/leaderboard.service.js";
import { leaderboardRepository } from "../../src/modules/leaderboard/leaderboard.repository.js";
import { memoryCache } from "../../src/common/utils/cache.js";

test("Leaderboard Service - Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
        memoryCache.clear();
    });

    afterEach(() => {
        memoryCache.clear();
    });

    await t.test("resolvePeriodKey - resolves keys correctly", () => {
        const testDate = new Date("2026-08-23T12:00:00Z"); // Sunday, Aug 23, 2026

        // 2026-08-23 is in week 34 of 2026 (usually)
        // Let's verify our service handles it:
        const daily = leaderboardService._resolvePeriodKey("daily", testDate);
        const weekly = leaderboardService._resolvePeriodKey("weekly", testDate);
        const monthly = leaderboardService._resolvePeriodKey("monthly", testDate);
        const allTime = leaderboardService._resolvePeriodKey("all_time", testDate);

        assert.strictEqual(daily, "2026-08-23");
        assert.strictEqual(weekly, "2026-W34");
        assert.strictEqual(monthly, "2026-08");
        assert.strictEqual(allTime, "ALL_TIME");
    });

    await t.test("getLeaderboard - returns entries ordered by rank ASC (weekly default)", async () => {
        const mockSnapshots = [
            { id: "1", period_type: "weekly", period_key: "2026-W34", rank: 1, user_id: "user-1", display_name: "Minh", avatar_url: null, xp_total: 1250, created_at: new Date() },
            { id: "2", period_type: "weekly", period_key: "2026-W34", rank: 2, user_id: "user-2", display_name: "Linh", avatar_url: "avatar2.jpg", xp_total: 900, created_at: new Date() },
        ];

        const findTopMock = mock.method(leaderboardRepository, "findTop", async () => {
            return mockSnapshots;
        });
        const findByUserMock = mock.method(leaderboardRepository, "findByUser", async () => {
            return null;
        });

        // Mock date in service to pin it to 2026-08-23
        const originalResolvePeriodKey = leaderboardService._resolvePeriodKey;
        leaderboardService._resolvePeriodKey = () => "2026-W34";

        try {
            const result = await leaderboardService.getLeaderboard({});
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.data.period_type, "weekly");
            assert.strictEqual(result.data.period_key, "2026-W34");
            assert.strictEqual(result.data.entries.length, 2);
            assert.strictEqual(result.data.entries[0].rank, 1);
            assert.strictEqual(result.data.entries[0].user_id, "user-1");
            assert.strictEqual(result.data.entries[0].display_name, "Minh");
            assert.strictEqual(result.data.entries[0].avatar_url, null);
            assert.strictEqual(result.data.entries[0].xp_total, 1250);
            assert.strictEqual(result.data.entries[1].rank, 2);
            assert.strictEqual(result.data.current_user, null);

            assert.strictEqual(findTopMock.mock.callCount(), 1);
            assert.strictEqual(findByUserMock.mock.callCount(), 0);
        } finally {
            leaderboardService._resolvePeriodKey = originalResolvePeriodKey;
        }
    });

    await t.test("getLeaderboard - period_type=all_time returns all-time rankings", async () => {
        const mockSnapshots = [
            { id: "1", period_type: "all_time", period_key: "ALL_TIME", rank: 1, user_id: "user-1", display_name: "Minh", avatar_url: null, xp_total: 10000, created_at: new Date() },
        ];

        const findTopMock = mock.method(leaderboardRepository, "findTop", async () => {
            return mockSnapshots;
        });

        const result = await leaderboardService.getLeaderboard({ period_type: "all_time" });
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.period_type, "all_time");
        assert.strictEqual(result.data.period_key, "ALL_TIME");
        assert.strictEqual(result.data.entries.length, 1);
        assert.strictEqual(result.data.entries[0].rank, 1);
        assert.strictEqual(findTopMock.mock.callCount(), 1);
    });

    await t.test("getLeaderboard - current user with no snapshot entry sees current_user: null", async () => {
        const findTopMock = mock.method(leaderboardRepository, "findTop", async () => {
            return [];
        });
        const findByUserMock = mock.method(leaderboardRepository, "findByUser", async () => {
            return null;
        });

        const result = await leaderboardService.getLeaderboard({}, "my-user-id");
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.current_user, null);
        assert.strictEqual(findByUserMock.mock.callCount(), 1);
    });

    await t.test("getLeaderboard - user ranked outside the top limit still sees their own accurate rank", async () => {
        const mockSnapshots = [
            { id: "1", period_type: "weekly", period_key: "2026-W34", rank: 1, user_id: "user-1", display_name: "Minh", avatar_url: null, xp_total: 1250, created_at: new Date() },
        ];
        const mockUserSnapshot = {
            id: "47",
            period_type: "weekly",
            period_key: "2026-W34",
            rank: 47,
            user_id: "my-user-id",
            display_name: "Me",
            avatar_url: null,
            xp_total: 320,
            created_at: new Date(),
        };

        mock.method(leaderboardRepository, "findTop", async () => {
            return mockSnapshots;
        });
        const findByUserMock = mock.method(leaderboardRepository, "findByUser", async () => {
            return mockUserSnapshot;
        });

        const result = await leaderboardService.getLeaderboard({ limit: 1 }, "my-user-id");
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.entries.length, 1);
        assert.strictEqual(result.data.entries[0].user_id, "user-1");
        assert.deepStrictEqual(result.data.current_user, {
            rank: 47,
            xp_total: 320,
        });
        assert.strictEqual(findByUserMock.mock.callCount(), 1);
    });

    await t.test("getLeaderboard - empty leaderboard returns empty entries list", async () => {
        mock.method(leaderboardRepository, "findTop", async () => {
            return [];
        });

        const result = await leaderboardService.getLeaderboard({});
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.entries.length, 0);
    });

    await t.test("getLeaderboard - cache hit and cache miss return identical entries data", async () => {
        const mockSnapshots = [
            { id: "1", period_type: "weekly", period_key: "2026-W34", rank: 1, user_id: "user-1", display_name: "Minh", avatar_url: null, xp_total: 1250, created_at: new Date() },
        ];

        let callCount = 0;
        mock.method(leaderboardRepository, "findTop", async () => {
            callCount++;
            return mockSnapshots;
        });

        // 1st request - cache miss
        const res1 = await leaderboardService.getLeaderboard({ limit: 10 });
        assert.strictEqual(callCount, 1);
        assert.strictEqual(res1.data.entries.length, 1);

        // 2nd request - cache hit
        const res2 = await leaderboardService.getLeaderboard({ limit: 10 });
        assert.strictEqual(callCount, 1); // should still be 1 due to cache
        assert.deepStrictEqual(res1.data.entries, res2.data.entries);
    });
});
