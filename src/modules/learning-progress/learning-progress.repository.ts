import { prisma } from "../../config/prisma.js";
import crypto from "crypto";

export const learningProgressRepository = {
    /**
     * Get all progress entries for a user to calculate status/JLPT counts
     */
    async getOverviewData(userId: string) {
        return prisma.learning_progress.findMany({
            where: { user_id: userId },
            select: {
                status: true,
                vocabularies: {
                    select: {
                        jlpt: true
                    }
                }
            }
        });
    },

    /**
     * Get platform total vocabulary count
     */
    async countPlatformVocabularies(): Promise<number> {
        return prisma.vocabularies.count();
    },

    /**
     * Check if a vocabulary exists
     */
    async checkVocabularyExists(vocabId: string): Promise<boolean> {
        const count = await prisma.vocabularies.count({
            where: { id: vocabId }
        });
        return count > 0;
    },

    async checkUserVocabularyExists(vocabId: string, userId: string): Promise<boolean> {
        const count = await prisma.user_vocabularies.count({
            where: { id: vocabId, user_id: userId }
        });
        return count > 0;
    },

    /**
     * Find a user's progress for a single vocabulary
     */
    async findProgress(userId: string, vocabularyId?: string, userVocabularyId?: string) {
        return prisma.learning_progress.findUnique({
            where: vocabularyId ? {
                user_id_vocabulary_id: {
                    user_id: userId,
                    vocabulary_id: vocabularyId
                }
            } : {
                user_id_user_vocabulary_id: {
                    user_id: userId,
                    user_vocabulary_id: userVocabularyId!
                }
            }
        });
    },

    /**
     * Find due items for review
     */
    async findDue(userId: string, filters: { jlpt?: string; status?: string }) {
        const where: any = {
            user_id: userId,
            next_review: { lte: new Date() }
        };

        if (filters.status) {
            where.status = filters.status as any;
        }

        if (filters.jlpt) {
            where.vocabularies = {
                jlpt: filters.jlpt as any
            };
        }

        return prisma.learning_progress.findMany({
            where,
            include: {
                vocabularies: {
                    select: {
                        kanji: true,
                        hiragana: true,
                        jlpt: true,
                        vocabulary_meanings: {
                            orderBy: { display_order: "asc" }
                        }
                    }
                },
                user_vocabularies: {
                    select: { kanji: true, hiragana: true, meaning: true, note: true }
                }
            }
        });
    },

    /**
     * Count due items for review (ignores limits)
     */
    async countDue(userId: string, filters: { jlpt?: string; status?: string }): Promise<number> {
        const where: any = {
            user_id: userId,
            next_review: { lte: new Date() }
        };

        if (filters.status) {
            where.status = filters.status as any;
        }

        if (filters.jlpt) {
            where.vocabularies = {
                jlpt: filters.jlpt as any
            };
        }

        return prisma.learning_progress.count({ where });
    },

    /**
     * Save vocabulary review result inside a single transaction
     */
    async saveReviewResult(
        userId: string,
        vocabularyId: string | undefined,
        progressData: {
            status: "NEW" | "LEARNING" | "REVIEWING" | "MASTERED";
            mastery: number;
            correct_count: number;
            wrong_count: number;
            last_review: Date;
            next_review: Date;
        },
        historyData: {
            correct: boolean;
            duration?: number;
        },
        userVocabularyId?: string
    ) {
        return prisma.$transaction(async (tx) => {
            const where = vocabularyId
                ? {
                    user_id_vocabulary_id: {
                        user_id: userId,
                        vocabulary_id: vocabularyId
                    }
                }
                : {
                    user_id_user_vocabulary_id: {
                        user_id: userId,
                        user_vocabulary_id: userVocabularyId!
                    }
                };
            const lp = await tx.learning_progress.upsert({
                where,
                create: {
                    id: crypto.randomUUID(),
                    user_id: userId,
                    vocabulary_id: vocabularyId ?? null,
                    user_vocabulary_id: userVocabularyId ?? null,
                    status: progressData.status as any,
                    mastery: progressData.mastery,
                    correct_count: progressData.correct_count,
                    wrong_count: progressData.wrong_count,
                    last_review: progressData.last_review,
                    next_review: progressData.next_review
                },
                update: {
                    status: progressData.status as any,
                    mastery: progressData.mastery,
                    correct_count: progressData.correct_count,
                    wrong_count: progressData.wrong_count,
                    last_review: progressData.last_review,
                    next_review: progressData.next_review
                }
            });

            await tx.review_histories.create({
                data: {
                    id: crypto.randomUUID(),
                    user_id: userId,
                    vocabulary_id: vocabularyId ?? null,
                    user_vocabulary_id: userVocabularyId ?? null,
                    reviewed_at: progressData.last_review,
                    correct: historyData.correct,
                    duration: historyData.duration !== undefined ? historyData.duration : null
                }
            });

            return lp;
        });
    },

    /**
     * Find review history records in a date range
     */
    async getReviewHistory(userId: string, start: Date, end: Date) {
        return prisma.review_histories.findMany({
            where: {
                user_id: userId,
                reviewed_at: {
                    gte: start,
                    lte: end
                }
            },
            select: {
                reviewed_at: true,
                correct: true
            }
        });
    }
};
