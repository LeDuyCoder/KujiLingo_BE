import { db } from "../../config/prisma.js";
import { lessonsRepository } from "./lessons.repository.js";
import { adminRepository } from "../admin/admin.repository.js";
import { memoryCache } from "../../common/utils/cache.js";
import type { CreateLessonBody, UpdateLessonBody } from "./lessons.types.js";

export const lessonsService = {
    /**
     * Get details of a lesson (with ordered topics). Cache for 30 minutes.
     */
    async getLessonDetail(id: string) {
        const cacheKey = `lessons:detail:${id}`;
        const cached = memoryCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const lesson = await lessonsRepository.findLessonDetail(id);
        if (!lesson) {
            throw new Error("LESSON_NOT_FOUND");
        }

        const result = {
            success: true,
            data: {
                id: lesson.id,
                course_id: lesson.course_id,
                title: lesson.title,
                description: lesson.description,
                topics: lesson.topics.map(t => ({
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    image: t.image,
                    order_no: t.order_no ?? 0
                }))
            }
        };

        memoryCache.set(cacheKey, result, 1800); // 30 minutes
        return result;
    },

    /**
     * Create a new lesson under a course
     */
    async createLesson(adminId: string, data: CreateLessonBody) {
        const newLesson = await db.prisma.$transaction(async (tx) => {
            // Check if parent course exists
            const courseExists = await lessonsRepository.checkCourseExists(data.course_id, tx);
            if (!courseExists) {
                throw new Error("INVALID_COURSE_REFERENCE");
            }

            const insertParams: { course_id: string; title: string; description?: string; order_no?: number } = {
                course_id: data.course_id,
                title: data.title
            };
            if (data.description !== undefined) {
                insertParams.description = data.description;
            }
            if (data.order_no !== undefined) {
                insertParams.order_no = data.order_no;
            }

            const lesson = await lessonsRepository.insertLesson(tx, insertParams);

            // Audit log
            await adminRepository.createAuditLog(tx, {
                adminId,
                action: "lesson.created",
                entityId: lesson.id,
                afterState: lesson
            });

            return lesson;
        });

        // Invalidate course and lesson list cache
        memoryCache.deletePattern("courses:list:*");
        memoryCache.delete(`courses:detail:${data.course_id}`);

        return {
            success: true,
            data: {
                id: newLesson.id,
                course_id: newLesson.course_id,
                title: newLesson.title,
                order_no: newLesson.order_no
            },
            message: "Lesson created successfully."
        };
    },

    /**
     * Update an existing lesson
     */
    async updateLesson(adminId: string, id: string, data: UpdateLessonBody) {
        const updateParams: { course_id?: string; title?: string; description?: string; order_no?: number } = {};
        let hasFields = false;

        if (data.course_id !== undefined) {
            updateParams.course_id = data.course_id;
            hasFields = true;
        }
        if (data.title !== undefined) {
            updateParams.title = data.title;
            hasFields = true;
        }
        if (data.description !== undefined) {
            updateParams.description = data.description;
            hasFields = true;
        }
        if (data.order_no !== undefined) {
            updateParams.order_no = data.order_no;
            hasFields = true;
        }

        if (!hasFields) {
            throw new Error("EMPTY_UPDATE");
        }

        const result = await db.prisma.$transaction(async (tx) => {
            const oldLesson = await lessonsRepository.findById(id, tx);
            if (!oldLesson) {
                throw new Error("LESSON_NOT_FOUND");
            }

            // Verify new course reference if changed
            if (updateParams.course_id !== undefined && updateParams.course_id !== oldLesson.course_id) {
                const courseExists = await lessonsRepository.checkCourseExists(updateParams.course_id, tx);
                if (!courseExists) {
                    throw new Error("INVALID_COURSE_REFERENCE");
                }
            }

            const updated = await lessonsRepository.updateLesson(tx, id, updateParams);

            // Audit log
            await adminRepository.createAuditLog(tx, {
                adminId,
                action: "lesson.updated",
                entityId: id,
                beforeState: oldLesson,
                afterState: updateParams
            });

            return {
                updated,
                oldCourseId: oldLesson.course_id
            };
        });

        // Invalidate caches
        memoryCache.delete(`lessons:detail:${id}`);
        memoryCache.deletePattern("courses:list:*");
        if (result.oldCourseId) {
            memoryCache.delete(`courses:detail:${result.oldCourseId}`);
        }
        if (updateParams.course_id && updateParams.course_id !== result.oldCourseId) {
            memoryCache.delete(`courses:detail:${updateParams.course_id}`);
        }

        return {
            success: true,
            data: {
                id,
                title: result.updated.title
            },
            message: "Lesson updated successfully."
        };
    },

    /**
     * Delete an empty lesson (hard delete)
     */
    async deleteLesson(adminId: string, id: string) {
        const result = await db.prisma.$transaction(async (tx) => {
            const oldLesson = await lessonsRepository.findById(id, tx);
            if (!oldLesson) {
                throw new Error("LESSON_NOT_FOUND");
            }

            // Conflict check if lesson has child topics
            const topicCount = await lessonsRepository.countTopicsByLessonId(id, tx);
            if (topicCount > 0) {
                throw new Error("LESSON_NOT_EMPTY");
            }

            await lessonsRepository.deleteLesson(tx, id);

            // Audit log
            await adminRepository.createAuditLog(tx, {
                adminId,
                action: "lesson.deleted",
                entityId: id,
                beforeState: oldLesson
            });

            return oldLesson;
        });

        // Invalidate caches
        memoryCache.delete(`lessons:detail:${id}`);
        memoryCache.deletePattern("courses:list:*");
        if (result.course_id) {
            memoryCache.delete(`courses:detail:${result.course_id}`);
        }

        return {
            success: true,
            message: "Lesson deleted successfully."
        };
    }
};
