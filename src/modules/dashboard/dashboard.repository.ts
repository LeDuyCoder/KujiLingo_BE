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
                lessons: {
                    orderBy: { order_no: "asc" },
                    take: 1,
                    include: {
                        topics: {
                            include: {
                                topic_vocabularies: {
                                    select: { vocabulary_id: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!recommendedCourse || recommendedCourse.lessons.length === 0) return null;

        const lesson = recommendedCourse.lessons[0]!;
        const vocabularyIds = [...new Set(
            lesson.topics.flatMap(topic => topic.topic_vocabularies.map(item => item.vocabulary_id))
        )];
        const totalVocabularyCount = vocabularyIds.length;
        const startedVocabularyCount = totalVocabularyCount > 0
            ? await prisma.learning_progress.count({
                where: {
                    user_id: userId,
                    vocabulary_id: { in: vocabularyIds },
                    status: { in: ["NEW", "LEARNING", "REVIEWING", "MASTERED"] }
                }
            })
            : 0;

        return {
            lesson_id: lesson.id,
            lesson_title: lesson.title || "Introduction",
            course_title: recommendedCourse.title || "Target Course",
            reason: "recommended" as const,
            lesson_progress_percent: totalVocabularyCount > 0
                ? Math.round((startedVocabularyCount / totalVocabularyCount) * 100)
                : 0
        };
    }
}
