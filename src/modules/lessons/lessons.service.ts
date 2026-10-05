import { db } from "../../config/prisma.js";
import { lessonsRepository } from "./lessons.repository.js";
import { adminRepository } from "../admin/admin.repository.js";
import { memoryCache } from "../../common/utils/cache.js";
import type { CreateLessonBody, UpdateLessonBody } from "./lessons.types.js";
import { hasActivePremium } from "../../common/utils/premium.js";
import { buildLessonProgress } from "../../common/utils/lesson-progress.js";

const LESSON_QUIZ_PASS_PERCENT = 70;

function orderQuizQuestions<T extends { id: string; question: string | null }>(questions: T[]): T[] {
    return [...questions].sort((a, b) => {
        const aNumber = Number(a.question?.match(/^Câu\s+(\d+)\b/i)?.[1] ?? Number.MAX_SAFE_INTEGER);
        const bNumber = Number(b.question?.match(/^Câu\s+(\d+)\b/i)?.[1] ?? Number.MAX_SAFE_INTEGER);
        return aNumber - bNumber || a.id.localeCompare(b.id);
    });
}

async function assertLessonUnlocked(id: string, userId?: string | null) {
    const lesson = await lessonsRepository.findLessonProgression(id);
    if (!lesson) throw new Error("LESSON_NOT_FOUND");
    if (!lesson.course_id) return lesson;

    const lessons = await lessonsRepository.findCourseProgressRows(lesson.course_id);
    const lessonIds = lessons.map(item => item.id);
    const completedIds = userId
        ? await lessonsRepository.findCompletedLessonIds(userId, lessonIds)
        : [];
    const quizProgress = buildLessonProgress(
        lessons.map(item => ({
            id: item.id,
            quiz_count: item.topics.reduce((count, topic) => count + topic.quizzes.length, 0)
        })),
        new Set(completedIds)
    );

    if (!quizProgress.find(item => item.id === id)?.is_unlocked) {
        throw new Error("LESSON_LOCKED");
    }
    return lesson;
}

export const lessonsService = {
    async assertLessonUnlocked(id: string, userId?: string | null) {
        return assertLessonUnlocked(id, userId);
    },

    async getLessonQuiz(id: string, userId?: string) {
        await assertLessonUnlocked(id, userId);
        const lesson = await lessonsRepository.findLessonQuiz(id);
        if (!lesson) throw new Error("LESSON_NOT_FOUND");

        const jlptLevel = lesson.courses?.title?.match(/N([1-5])/i)?.[1];
        if (jlptLevel && Number(jlptLevel) <= 3 && !(await hasActivePremium(userId))) {
            throw new Error("PRO_REQUIRED");
        }

        const questions = lesson.topics.flatMap(topic => topic.quizzes.flatMap(quiz =>
            orderQuizQuestions(quiz.quiz_questions).map(question => ({
                id: question.id,
                quiz_id: quiz.id,
                quiz_title: quiz.title,
                question: question.question,
                audio: question.audio,
                image: question.image,
                answers: question.quiz_answers.map(({ id: answerId, answer }) => ({ id: answerId, answer }))
            }))
        ));
        if (questions.length === 0) throw new Error("QUIZ_NOT_FOUND");

        return { success: true, data: { lesson_id: lesson.id, lesson_title: lesson.title, questions } };
    },

    async submitLessonQuiz(id: string, userId: string | undefined, submitted: Array<{ question_id: string; answer_id: string }>) {
        if (!userId) throw new Error("UNAUTHORIZED");
        const progression = await assertLessonUnlocked(id, userId);
        const lesson = await lessonsRepository.findLessonQuiz(id);
        if (!lesson) throw new Error("LESSON_NOT_FOUND");

        const jlptLevel = lesson.courses?.title?.match(/N([1-5])/i)?.[1];
        if (jlptLevel && Number(jlptLevel) <= 3 && !(await hasActivePremium(userId))) {
            throw new Error("PRO_REQUIRED");
        }

        const questions = lesson.topics.flatMap(topic => topic.quizzes.flatMap(quiz => quiz.quiz_questions));
        if (questions.length === 0) throw new Error("QUIZ_NOT_FOUND");
        const submittedIds = new Set(submitted.map(answer => answer.question_id));
        if (submitted.length !== questions.length || submittedIds.size !== questions.length) {
            throw new Error("INVALID_QUIZ_ANSWERS");
        }

        const results = submitted.map(submission => {
            const question = questions.find(item => item.id === submission.question_id);
            const selected = question?.quiz_answers.find(answer => answer.id === submission.answer_id);
            const correct = question?.quiz_answers.find(answer => answer.is_correct === true);
            if (!question || !selected || !correct) throw new Error("INVALID_QUIZ_ANSWERS");
            return {
                question_id: question.id,
                selected_answer_id: selected.id,
                correct_answer_id: correct.id,
                is_correct: selected.id === correct.id
            };
        });
        const score = results.filter(result => result.is_correct).length;
        const passedThisAttempt = score * 100 >= questions.length * LESSON_QUIZ_PASS_PERCENT;
        if (passedThisAttempt) {
            await lessonsRepository.markLessonQuizCompleted(userId, id);
        }
        const lessonCompleted = passedThisAttempt || await lessonsRepository.hasPassedLessonQuiz(userId, id);
        return {
            success: true,
            data: {
                score,
                total: questions.length,
                percent: Math.round((score / questions.length) * 100),
                results,
                lesson_completed: lessonCompleted,
                course_id: progression.course_id
            }
        };
    },

    /**
     * Get details of a lesson (with ordered topics). Cache for 30 minutes.
     */
    async getLessonDetail(id: string, userId?: string) {
        await assertLessonUnlocked(id, userId);
        const cacheKey = `lessons:detail:${id}`;
        const accessCacheKey = `lessons:detail:access:${id}`;
        const cached = memoryCache.get(cacheKey);
        if (cached) {
            let courseTitle = memoryCache.get(accessCacheKey) as string | null;
            if (courseTitle === null) {
                const cachedLesson = await lessonsRepository.findLessonDetail(id);
                if (!cachedLesson) {
                    throw new Error("LESSON_NOT_FOUND");
                }
                courseTitle = cachedLesson.courses?.title ?? "";
                memoryCache.set(accessCacheKey, courseTitle, 1800);
            }
            const cachedJlptLevel = courseTitle?.match(/N([1-5])/i)?.[1];
            if (cachedJlptLevel && Number(cachedJlptLevel) <= 3 && !(await hasActivePremium(userId))) {
                throw new Error("PRO_REQUIRED");
            }
            return cached;
        }

        const lesson = await lessonsRepository.findLessonDetail(id);
        if (!lesson) {
            throw new Error("LESSON_NOT_FOUND");
        }
        const jlptLevel = lesson.courses?.title?.match(/N([1-5])/i)?.[1];
        if (jlptLevel && Number(jlptLevel) <= 3 && !(await hasActivePremium(userId))) {
            throw new Error("PRO_REQUIRED");
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
        memoryCache.set(accessCacheKey, lesson.courses?.title ?? "", 1800);
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
        memoryCache.delete(`lessons:detail:access:${id}`);
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
        memoryCache.delete(`lessons:detail:access:${id}`);
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
