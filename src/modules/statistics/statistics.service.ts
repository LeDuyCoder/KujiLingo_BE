import { prisma } from "../../config/prisma.js";
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


export async function recordActivity(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [todayRow, yesterdayRow] = await Promise.all([
        prisma.user_statistics_daily.findUnique({
            where: {
                user_id_stat_date: {
                    user_id: userId,
                    stat_date: today
                }
            }
        }),
        prisma.user_statistics_daily.findUnique({
            where: {
                user_id_stat_date: {
                    user_id: userId,
                    stat_date: yesterday
                }
            }
        })
    ]);

    let newStreak = 0;

    const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { streak: true, longest_streak: true, exp: true, learning_goal_minutes: true }
    });

    if (user) {
        newStreak = user.streak ?? 0;
        
        if (!todayRow) {
            // First activity of today - calculate streak
            if (yesterdayRow && (yesterdayRow.minutes_studied ?? 0) > 0) {
                newStreak = (user.streak ?? 0) + 1;
            } else {
                newStreak = 1;
            }

            const longestStreak = Math.max(newStreak, user.longest_streak ?? 0);
            const newExp = (user.exp ?? 0) + 10; // +10 EXP reward for first daily activity

            await prisma.users.update({
                where: { id: userId },
                data: {
                    streak: newStreak,
                    longest_streak: longestStreak,
                    exp: newExp
                }
            });
        }
    }

    // Upsert today's stats row to increment minutes_studied by 1
    const updatedStats = await prisma.user_statistics_daily.upsert({
        where: {
            user_id_stat_date: {
                user_id: userId,
                stat_date: today
            }
        },
        create: {
            user_id: userId,
            stat_date: today,
            minutes_studied: 1
        },
        update: {
            minutes_studied: {
                increment: 1
            }
        }
    });

    const goalMinutes = user?.learning_goal_minutes ?? 15;
    const minutesStudied = updatedStats.minutes_studied ?? 1;
    const percent = Math.min(Math.round((minutesStudied / goalMinutes) * 100), 100);

    return {
        streak: newStreak,
        minutes_studied_today: minutesStudied,
        percent
    };
}