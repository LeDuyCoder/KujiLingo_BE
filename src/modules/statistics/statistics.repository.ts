import { prisma } from "../../config/prisma.js";

export const statisticsRepository = {
    async getUserBasic(userId: string) {
        return prisma.users.findUnique({
            where: { id: userId },
            select: { level: true, exp: true, streak: true }
        });
    },

    async getReviewsCount(userId: string) {
        return prisma.review_histories.count({
            where: { user_id: userId }
        });
    },

    async getCorrectReviewsCount(userId: string) {
        return prisma.review_histories.count({
            where: { user_id: userId, correct: true }
        });
    },

    async getSrsReviewsCount(userId: string) {
        return prisma.srs_review_histories.count({
            where: { user_id: userId }
        });
    },

    async getCorrectSrsReviewsCount(userId: string) {
        return prisma.srs_review_histories.count({
            where: { user_id: userId, rating: { not: 'again' as any } }
        });
    },

    async getMasteredProgressCount(userId: string) {
        return prisma.learning_progress.count({
            where: { user_id: userId, status: 'MASTERED' as any }
        });
    },

    async getDailyWordsReviewedSum(userId: string) {
        const dailyStats = await prisma.user_statistics_daily.aggregate({
            where: { user_id: userId },
            _sum: { words_reviewed: true }
        });
        return dailyStats._sum.words_reviewed || 0;
    }
};
