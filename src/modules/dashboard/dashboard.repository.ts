import { prisma } from "../../config/prisma.js";

export const dashboardRepository = {
    async getUserBasics(userId: string) {
        return prisma.users.findUnique({
            where: { id: userId },
            select: {
                streak: true,
                longest_streak: true,
                learning_goal_minutes: true,
                jlpt_target_level: true
            }
        });
    },

    async getTodayStats(userId: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return prisma.user_statistics_daily.findUnique({
            where: {
                user_id_stat_date: {
                    user_id: userId,
                    stat_date: today
                }
            }
        });
    },

    async countSrsDue(userId: string) {
        return prisma.learning_progress.count({
            where: {
                user_id: userId,
                next_review: { lte: new Date() }
            }
        });
    },

    async findContinueLearning(userId: string, targetLevel: string) {
        const recommendedCourse = await prisma.courses.findFirst({
            where: {
                title: { contains: targetLevel },
            },
            include: {
                lessons: { orderBy: { order_no: "asc" }, take: 1 }
            }
        });

        if (!recommendedCourse || recommendedCourse.lessons.length === 0) return null;

        return {
            lesson_id: recommendedCourse.lessons[0]?.id,
            lesson_title: recommendedCourse.lessons[0]?.title || "Introduction",
            course_title: recommendedCourse.title || "Target Course",
            reason: "recommended" as const
        };
    }
}