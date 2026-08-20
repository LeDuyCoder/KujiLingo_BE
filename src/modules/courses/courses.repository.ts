import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../config/prisma.js";
import crypto from "node:crypto";

type TransactionClient = Prisma.TransactionClient;

export async function findManyCourses(page: number, limit: number) {
    return prisma.courses.findMany({
        where: { deleted_at: null },
        orderBy: { order_no: "asc" },
        skip: (page - 1) * limit,
        take: limit,
    });
}

export async function countAllCourses() {
    return prisma.courses.count({ where: { deleted_at: null } });
}

export async function countLessonsByCourses(courseIds: string[]) {
    return prisma.lessons.groupBy({
        by: ["course_id"],
        where: {
            course_id: { in: courseIds }
        },
        _count: {
            id: true
        }
    });
}

export async function findCourseById(id: string, includeDeleted = false, tx?: TransactionClient) {
    const client = tx || prisma;
    return client.courses.findFirst({
        where: { 
            id,
            ...(includeDeleted ? {} : { deleted_at: null })
        },
    });
}

export async function findLessonsByCourseId(courseId: string) {
    return prisma.lessons.findMany({
        where: { course_id: courseId },
        orderBy: { order_no: "asc" },
        select: {
            id: true,
            title: true,
            description: true,
            order_no: true
        }
    });
}

export async function createCourse(tx: TransactionClient, data: {
    title: string;
    description?: string | undefined;
    image?: string | undefined;
    order_no?: number | undefined;
}) {
    const createData: Prisma.coursesUncheckedCreateInput = {
        id: crypto.randomUUID(),
        title: data.title,
    };

    if (data.description !== undefined) {
        createData.description = data.description ?? null;
    }
    if (data.image !== undefined) {
        createData.image = data.image ?? null;
    }
    if (data.order_no !== undefined) {
        createData.order_no = data.order_no ?? null;
    }

    return tx.courses.create({
        data: createData,
    });
}

export async function updateCourse(tx: TransactionClient, id: string, data: {
    title?: string | undefined;
    description?: string | undefined;
    image?: string | undefined;
    order_no?: number | undefined;
}) {
    const updateData: Prisma.coursesUncheckedUpdateInput = {};

    if (data.title !== undefined) {
        updateData.title = data.title;
    }
    if (data.description !== undefined) {
        updateData.description = data.description ?? null;
    }
    if (data.image !== undefined) {
        updateData.image = data.image ?? null;
    }
    if (data.order_no !== undefined) {
        updateData.order_no = data.order_no ?? null;
    }

    return tx.courses.update({
        where: { id },
        data: updateData,
    });
}

export async function softDeleteCourse(tx: TransactionClient, id: string) {
    return tx.courses.update({
        where: { id },
        data: { deleted_at: new Date() },
    });
}

export async function restoreCourse(tx: TransactionClient, id: string) {
    return tx.courses.update({
        where: { id },
        data: { deleted_at: null },
    });
}

export async function countLessonsInCourse(courseId: string, tx?: TransactionClient) {
    const client = tx || prisma;
    return client.lessons.count({
        where: { course_id: courseId },
    });
}

export const courseRepository = {
    findManyCourses,
    countAllCourses,
    countLessonsByCourses,
    findCourseById,
    findLessonsByCourseId,
    createCourse,
    updateCourse,
    softDeleteCourse,
    restoreCourse,
    countLessonsInCourse,
};
