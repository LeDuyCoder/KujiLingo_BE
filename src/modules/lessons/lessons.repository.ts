import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import crypto from "node:crypto";

type TransactionClient = Prisma.TransactionClient;

export const lessonsRepository = {
    /**
     * Find a lesson by ID, including its topics ordered by order_no ASC
     */
    async findLessonDetail(id: string) {
        return prisma.lessons.findUnique({
            where: { id },
            include: {
                courses: { select: { title: true } },
                topics: {
                    orderBy: { order_no: "asc" }
                }
            }
        });
    },

    async findLessonQuiz(id: string) {
        return prisma.lessons.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                courses: { select: { title: true } },
                topics: {
                    orderBy: { order_no: "asc" },
                    select: {
                        quizzes: {
                            select: {
                                id: true,
                                title: true,
                                quiz_questions: {
                                    select: {
                                        id: true,
                                        question: true,
                                        audio: true,
                                        image: true,
                                        quiz_answers: {
                                            select: { id: true, answer: true, is_correct: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    },

    async findLessonProgression(id: string) {
        return prisma.lessons.findUnique({
            where: { id },
            select: { id: true, course_id: true }
        });
    },

    async findCourseProgressRows(courseId: string) {
        return prisma.lessons.findMany({
            where: { course_id: courseId },
            orderBy: [{ order_no: "asc" }, { id: "asc" }],
            select: {
                id: true,
                topics: { select: { quizzes: { select: { id: true } } } }
            }
        });
    },

    async findCompletedLessonIds(userId: string, lessonIds: string[]) {
        if (lessonIds.length === 0) return [];
        const rows = await prisma.user_lesson_quiz_completions.findMany({
            where: { user_id: userId, lesson_id: { in: lessonIds }, passed: true },
            select: { lesson_id: true }
        });
        return rows.map(row => row.lesson_id);
    },

    async hasPassedLessonQuiz(userId: string, lessonId: string) {
        const completion = await prisma.user_lesson_quiz_completions.findFirst({
            where: { user_id: userId, lesson_id: lessonId, passed: true },
            select: { lesson_id: true }
        });
        return completion !== null;
    },

    async markLessonQuizCompleted(userId: string, lessonId: string) {
        return prisma.user_lesson_quiz_completions.upsert({
            where: { user_id_lesson_id: { user_id: userId, lesson_id: lessonId } },
            create: { user_id: userId, lesson_id: lessonId, passed: true },
            update: { completed_at: new Date(), passed: true }
        });
    },

    /**
     * Find a lesson by ID without relations
     */
    async findById(id: string, tx?: TransactionClient) {
        const client = tx || prisma;
        return client.lessons.findUnique({
            where: { id }
        });
    },

    /**
     * Check if a course exists and is active (not soft-deleted)
     */
    async checkCourseExists(courseId: string, tx?: TransactionClient): Promise<boolean> {
        const client = tx || prisma;
        const count = await client.courses.count({
            where: {
                id: courseId,
                deleted_at: null
            }
        });
        return count > 0;
    },

    /**
     * Insert a new lesson under a course
     */
    async insertLesson(
        tx: TransactionClient,
        data: {
            course_id: string;
            title: string;
            description?: string;
            order_no?: number;
        }
    ) {
        return tx.lessons.create({
            data: {
                id: crypto.randomUUID(),
                course_id: data.course_id,
                title: data.title,
                description: data.description !== undefined ? data.description : null,
                order_no: data.order_no !== undefined ? data.order_no : 0
            }
        });
    },

    /**
     * Update an existing lesson
     */
    async updateLesson(
        tx: TransactionClient,
        id: string,
        data: {
            course_id?: string;
            title?: string;
            description?: string;
            order_no?: number;
        }
    ) {
        const updateData: any = {};
        if (data.course_id !== undefined) updateData.course_id = data.course_id;
        if (data.title !== undefined) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.order_no !== undefined) updateData.order_no = data.order_no;

        return tx.lessons.update({
            where: { id },
            data: updateData
        });
    },

    /**
     * Delete a lesson (hard delete)
     */
    async deleteLesson(tx: TransactionClient, id: string) {
        return tx.lessons.delete({
            where: { id }
        });
    },

    /**
     * Count the number of topics belonging to a lesson
     */
    async countTopicsByLessonId(lessonId: string, tx?: TransactionClient): Promise<number> {
        const client = tx || prisma;
        return client.topics.count({
            where: { lesson_id: lessonId }
        });
    }
};
