import { statisticsRepository } from "./statistics.repository.js";

export async function getStats(userId: string) {
    const user = await statisticsRepository.getUserBasic(userId);

    if (!user) {
        throw new Error("User not found");
    }

    const [reviewCount, srsCount, mastered, dailyWords, correctCount, correctSrsCount] = await Promise.all([
        statisticsRepository.getReviewsCount(userId),
        statisticsRepository.getSrsReviewsCount(userId),
        statisticsRepository.getMasteredProgressCount(userId),
        statisticsRepository.getDailyWordsReviewedSum(userId),
        statisticsRepository.getCorrectReviewsCount(userId),
        statisticsRepository.getCorrectSrsReviewsCount(userId)
    ]);

    const total_reviews = reviewCount + srsCount + dailyWords;
    const totalCorrect = correctCount + correctSrsCount;

    const accuracy_percent = total_reviews > 0 ? Math.round((totalCorrect / total_reviews) * 100 * 10) / 10 : null;

    return {
        level: user.level ?? 1,
        exp: user.exp ?? 0,
        streak: user.streak ?? 0,
        total_reviews,
        correct_reviews: totalCorrect,
        accuracy_percent,
        total_mastered: mastered
    };
}
