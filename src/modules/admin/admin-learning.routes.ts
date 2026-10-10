import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { Prisma } from "../../../generated/prisma/client.js";
import { z } from "zod";
import { adminGuard } from "../../common/middlewares/admin.guard.js";
import { memoryCache } from "../../common/utils/cache.js";
import { prisma } from "../../config/prisma.js";

const topicParams = z.object({ topicId: z.string().uuid() });
const lessonParams = z.object({ lessonId: z.string().uuid() });
const quizParams = z.object({ quizId: z.string().uuid() });
const answerSchema = z.object({
    id: z.string().uuid().optional(),
    answer: z.string().trim().min(1).max(1000),
    is_correct: z.boolean(),
});
const questionSchema = z.object({
    id: z.string().uuid().optional(),
    question: z.string().trim().min(1).max(2000),
    audio: z.string().max(500).nullable().optional(),
    image: z.string().max(500).nullable().optional(),
    answers: z.array(answerSchema).length(4).refine((answers) => answers.filter((answer) => answer.is_correct).length === 1, "Each question must have exactly one correct answer."),
});
const quizBody = z.object({
    title: z.string().trim().min(1).max(255),
    questions: z.array(questionSchema).min(1).max(100),
});
type QuizInput = z.infer<typeof quizBody>;
type AuditJson = Prisma.InputJsonValue;

function auditJson(value: unknown): AuditJson {
    return JSON.parse(JSON.stringify(value)) as AuditJson;
}

function rowsForQuiz(quizId: string, questions: QuizInput["questions"]) {
    const questionRows = questions.map((question) => ({
        id: question.id ?? randomUUID(),
        quiz_id: quizId,
        question: question.question,
        audio: question.audio ?? null,
        image: question.image ?? null,
    }));
    const answerRows = questions.flatMap((question, index) => question.answers.map((answer) => ({
        id: answer.id ?? randomUUID(),
        question_id: questionRows[index]!.id,
        answer: answer.answer,
        is_correct: answer.is_correct,
    })));
    return { questionRows, answerRows };
}

function invalidateCourseCaches() {
    memoryCache.deletePattern("courses:*");
}

export async function adminLearningRoutes(app: FastifyInstance) {
    const router = app.withTypeProvider<ZodTypeProvider>();
    router.addHook("preHandler", adminGuard);

    router.get("/api/v1/admin/lessons/:lessonId/topics", { schema: { params: lessonParams } }, async (request, reply) => {
        const lesson = await prisma.lessons.findUnique({ where: { id: request.params.lessonId }, select: { id: true } });
        if (!lesson) return reply.code(404).send({ success: false, error: { code: "LESSON_NOT_FOUND", message: "Lesson not found." } });
        const topics = await prisma.topics.findMany({ where: { lesson_id: lesson.id }, orderBy: [{ order_no: "asc" }, { id: "asc" }] });
        return { success: true, data: topics };
    });

    router.get("/api/v1/admin/topics/:topicId/quizzes", { schema: { params: topicParams } }, async (request, reply) => {
        const topic = await prisma.topics.findUnique({ where: { id: request.params.topicId }, select: { id: true } });
        if (!topic) return reply.code(404).send({ success: false, error: { code: "TOPIC_NOT_FOUND", message: "Topic not found." } });
        const quizzes = await prisma.quizzes.findMany({
            where: { topic_id: topic.id },
            include: { quiz_questions: { include: { quiz_answers: true } } },
            orderBy: { id: "asc" },
        });
        return { success: true, data: quizzes };
    });

    router.post("/api/v1/admin/topics/:topicId/quizzes", { schema: { params: topicParams, body: quizBody } }, async (request, reply) => {
        const topic = await prisma.topics.findUnique({ where: { id: request.params.topicId }, select: { id: true } });
        if (!topic) return reply.code(404).send({ success: false, error: { code: "TOPIC_NOT_FOUND", message: "Topic not found." } });

        const quizId = randomUUID();
        const { questionRows, answerRows } = rowsForQuiz(quizId, request.body.questions);
        const questionIds = questionRows.map((question) => question.id);
        const answerIds = answerRows.map((answer) => answer.id);
        if (new Set(questionIds).size !== questionIds.length || new Set(answerIds).size !== answerIds.length) {
            return reply.code(400).send({ success: false, error: { code: "DUPLICATE_CHILD_ID", message: "Question and answer IDs must be unique." } });
        }
        const [questionConflicts, answerConflicts] = await Promise.all([
            prisma.quiz_questions.findMany({ where: { id: { in: questionIds } }, select: { id: true } }),
            prisma.quiz_answers.findMany({ where: { id: { in: answerIds } }, select: { id: true } }),
        ]);
        if (questionConflicts.length || answerConflicts.length) {
            return reply.code(409).send({ success: false, error: { code: "CHILD_ID_CONFLICT", message: "A question or answer ID already exists." } });
        }
        const quiz = await prisma.$transaction(async (tx) => {
            const created = await tx.quizzes.create({ data: { id: quizId, topic_id: topic.id, title: request.body.title } });
            await tx.quiz_questions.createMany({ data: questionRows });
            await tx.quiz_answers.createMany({ data: answerRows });
            const after = { ...created, quiz_questions: questionRows.map((question) => ({ ...question, quiz_answers: answerRows.filter((answer) => answer.question_id === question.id) })) };
            await tx.admin_audit_logs.create({ data: { admin_id: request.user!.id, action: "quiz.created", entity_id: quizId, after_state: auditJson(after) } });
            return after;
        });
        invalidateCourseCaches();
        return reply.code(201).send({ success: true, data: quiz });
    });

    router.patch("/api/v1/admin/quizzes/:quizId", { schema: { params: quizParams, body: quizBody } }, async (request, reply) => {
        const before = await prisma.quizzes.findUnique({
            where: { id: request.params.quizId },
            include: { quiz_questions: { include: { quiz_answers: true } } },
        });
        if (!before) return reply.code(404).send({ success: false, error: { code: "QUIZ_NOT_FOUND", message: "Quiz not found." } });

        const { questionRows, answerRows } = rowsForQuiz(before.id, request.body.questions);
        const oldQuestionIds = before.quiz_questions.map((question) => question.id);
        const requestedQuestionIds = questionRows.map((question) => question.id);
        const requestedAnswerIds = answerRows.map((answer) => answer.id);
        if (new Set(requestedQuestionIds).size !== requestedQuestionIds.length || new Set(requestedAnswerIds).size !== requestedAnswerIds.length) {
            return reply.code(400).send({ success: false, error: { code: "DUPLICATE_CHILD_ID", message: "Question and answer IDs must be unique." } });
        }

        const questionConflicts = await prisma.quiz_questions.findMany({ where: { id: { in: requestedQuestionIds }, quiz_id: { not: before.id } }, select: { id: true } });
        const answerConflicts = await prisma.quiz_answers.findMany({ where: { id: { in: requestedAnswerIds }, question_id: { notIn: oldQuestionIds } }, select: { id: true } });
        if (questionConflicts.length || answerConflicts.length) {
            return reply.code(409).send({ success: false, error: { code: "CHILD_ID_CONFLICT", message: "A question or answer ID belongs to another quiz." } });
        }

        const after = await prisma.$transaction(async (tx) => {
            await tx.quiz_answers.deleteMany({ where: { question_id: { in: oldQuestionIds } } });
            await tx.quiz_questions.deleteMany({ where: { quiz_id: before.id } });
            const updated = await tx.quizzes.update({ where: { id: before.id }, data: { title: request.body.title } });
            await tx.quiz_questions.createMany({ data: questionRows });
            await tx.quiz_answers.createMany({ data: answerRows });
            const result = { ...updated, quiz_questions: questionRows.map((question) => ({ ...question, quiz_answers: answerRows.filter((answer) => answer.question_id === question.id) })) };
            await tx.admin_audit_logs.create({ data: { admin_id: request.user!.id, action: "quiz.updated", entity_id: before.id, before_state: auditJson(before), after_state: auditJson(result) } });
            return result;
        });
        invalidateCourseCaches();
        return { success: true, data: after };
    });

    router.delete("/api/v1/admin/quizzes/:quizId", { schema: { params: quizParams } }, async (request, reply) => {
        const before = await prisma.quizzes.findUnique({
            where: { id: request.params.quizId },
            include: { quiz_questions: { include: { quiz_answers: true } } },
        });
        if (!before) return reply.code(404).send({ success: false, error: { code: "QUIZ_NOT_FOUND", message: "Quiz not found." } });
        const questionIds = before.quiz_questions.map((question) => question.id);
        await prisma.$transaction(async (tx) => {
            await tx.quiz_answers.deleteMany({ where: { question_id: { in: questionIds } } });
            await tx.quiz_questions.deleteMany({ where: { quiz_id: before.id } });
            await tx.quizzes.delete({ where: { id: before.id } });
            await tx.admin_audit_logs.create({ data: { admin_id: request.user!.id, action: "quiz.deleted", entity_id: before.id, before_state: auditJson(before) } });
        });
        invalidateCourseCaches();
        return { success: true, message: "Quiz deleted." };
    });
}
