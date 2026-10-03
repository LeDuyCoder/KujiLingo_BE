import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { getStats } from "../../src/modules/statistics/statistics.service.js";
import { statisticsRepository } from "../../src/modules/statistics/statistics.repository.js";

test("Statistics Service - Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
    });

    afterEach(() => {
        mock.restoreAll();
    });

    await t.test("getStats - success with proper default fallbacks for null values", async () => {
        const userId = "test-user-id";

        // Mock repository calls
        const getUserBasicMock = mock.method(statisticsRepository, "getUserBasic", async () => ({
            level: null,
            exp: null,
            streak: null
        }));

        const getReviewsCountMock = mock.method(statisticsRepository, "getReviewsCount", async () => 0);
        const getCorrectReviewsCountMock = mock.method(statisticsRepository, "getCorrectReviewsCount", async () => 0);
        const getSrsReviewsCountMock = mock.method(statisticsRepository, "getSrsReviewsCount", async () => 0);
        const getCorrectSrsReviewsCountMock = mock.method(statisticsRepository, "getCorrectSrsReviewsCount", async () => 0);
        const getMasteredProgressCountMock = mock.method(statisticsRepository, "getMasteredProgressCount", async () => 0);
        const getDailyWordsReviewedSumMock = mock.method(statisticsRepository, "getDailyWordsReviewedSum", async () => 0);

        const result = await getStats(userId);

        // Verify null fallbacks
        assert.strictEqual(result.level, 1);
        assert.strictEqual(result.exp, 0);
        assert.strictEqual(result.streak, 0);
        
        // Verify aggregated counts
        assert.strictEqual(result.total_reviews, 0);
        assert.strictEqual(result.correct_reviews, 0);
        assert.strictEqual(result.total_mastered, 0);
        assert.strictEqual(result.accuracy_percent, null);

        // Verify methods were called
        assert.strictEqual(getUserBasicMock.mock.callCount(), 1);
        assert.strictEqual(getReviewsCountMock.mock.callCount(), 1);
        assert.strictEqual(getCorrectReviewsCountMock.mock.callCount(), 1);
        assert.strictEqual(getSrsReviewsCountMock.mock.callCount(), 1);
        assert.strictEqual(getCorrectSrsReviewsCountMock.mock.callCount(), 1);
        assert.strictEqual(getMasteredProgressCountMock.mock.callCount(), 1);
        assert.strictEqual(getDailyWordsReviewedSumMock.mock.callCount(), 1);
    });

    await t.test("getStats - success with correctly aggregated statistics and accuracy", async () => {
        const userId = "test-user-id-2";

        // Mock repository calls
        mock.method(statisticsRepository, "getUserBasic", async () => ({
            level: 5,
            exp: 1000,
            streak: 7
        }));

        mock.method(statisticsRepository, "getReviewsCount", async () => 20);
        mock.method(statisticsRepository, "getCorrectReviewsCount", async () => 10);
        mock.method(statisticsRepository, "getSrsReviewsCount", async () => 50);
        mock.method(statisticsRepository, "getCorrectSrsReviewsCount", async () => 40);
        mock.method(statisticsRepository, "getMasteredProgressCount", async () => 25);
        mock.method(statisticsRepository, "getDailyWordsReviewedSum", async () => 30);

        const result = await getStats(userId);

        assert.strictEqual(result.level, 5);
        assert.strictEqual(result.exp, 1000);
        assert.strictEqual(result.streak, 7);
        
        // Total Reviews = 20 (legacy) + 50 (srs) + 30 (daily) = 100
        assert.strictEqual(result.total_reviews, 100);
        
        // Correct Reviews = 10 (legacy) + 40 (srs) = 50
        assert.strictEqual(result.correct_reviews, 50);
        
        assert.strictEqual(result.total_mastered, 25);
        
        // Accuracy = 50 / 100 = 50.0%
        assert.strictEqual(result.accuracy_percent, 50);
    });

    await t.test("getStats - accuracy is rounded to one decimal place", async () => {
        const userId = "test-user-id-3";

        mock.method(statisticsRepository, "getUserBasic", async () => ({
            level: 1, exp: 10, streak: 1
        }));

        // 1 correct out of 3 total -> 33.3%
        mock.method(statisticsRepository, "getReviewsCount", async () => 3);
        mock.method(statisticsRepository, "getCorrectReviewsCount", async () => 1);
        mock.method(statisticsRepository, "getSrsReviewsCount", async () => 0);
        mock.method(statisticsRepository, "getCorrectSrsReviewsCount", async () => 0);
        mock.method(statisticsRepository, "getMasteredProgressCount", async () => 0);
        mock.method(statisticsRepository, "getDailyWordsReviewedSum", async () => 0);

        const result = await getStats(userId);

        assert.strictEqual(result.total_reviews, 3);
        assert.strictEqual(result.correct_reviews, 1);
        assert.strictEqual(result.accuracy_percent, 33.3);
    });

    await t.test("getStats - throws error if user not found", async () => {
        const userId = "not-found";

        // Mock user not found
        mock.method(statisticsRepository, "getUserBasic", async () => null);

        await assert.rejects(
            getStats(userId),
            /User not found/
        );
    });
});
