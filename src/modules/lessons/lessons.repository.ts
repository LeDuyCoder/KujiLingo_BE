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
                topics: {
                    orderBy: { order_no: "asc" }
                }
            }
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
