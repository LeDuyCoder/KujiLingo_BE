import { prisma } from "../../config/prisma.js";

export async function getStats(userId: string) {
    const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { level: true, exp: true, streak: true }
    });

    if (!user) {
        throw new Error("User not found");
    }

    const [reviewCount, srsCount, mastered, dailyStats] = await Promise.all([
        prisma.review_histories.count({ where: { user_id: userId } }),
        prisma.srs_review_histories.count({ where: { user_id: userId } }),
        prisma.learning_progress.count({ where: { user_id: userId, status: 'MASTERED' as any } }),
        prisma.user_statistics_daily.aggregate({
            where: { user_id: userId },
            _sum: { words_reviewed: true }
        })
    ]);

    const total_reviews = reviewCount + srsCount + (dailyStats._sum.words_reviewed || 0);
    
    // For review_histories, correct=true
    const correctCount = await prisma.review_histories.count({
        where: { user_id: userId, correct: true }
    });
    // For srs_review_histories, rating > again
    const correctSrsCount = await prisma.srs_review_histories.count({
        where: { user_id: userId, rating: { not: 'again' as any } }
    });

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
