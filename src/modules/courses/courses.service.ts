import { db } from "../../config/prisma.js";
import { courseRepository } from "./courses.repository.js";
import { adminRepository } from "../admin/admin.repository.js";
import { memoryCache } from "../../common/utils/cache.js";
import type { ListCoursesQuery, CreateCourseBody, UpdateCourseBody } from "./courses.schema.js";
import type { CourseDTO, CourseDetailDTO } from "./courses.types.js";

/**
 * Lấy danh sách khóa học có phân trang (Public)
 * Tích hợp Cache 30 phút
 */
export async function listCourses(query: ListCoursesQuery) {
    const cacheKey = `courses:list:${query.page}:${query.limit}`;
    const cachedData = memoryCache.get(cacheKey);

    if (cachedData) {
        return cachedData;
    }

    const courses = await courseRepository.findManyCourses(query.page, query.limit);
    const total = await courseRepository.countAllCourses();

    const courseIds = courses.map(c => c.id);
    const lessonCounts = await courseRepository.countLessonsByCourses(courseIds);

    // Map courseId -> lesson_count
    const countsMap = new Map<string, number>();
    lessonCounts.forEach(lc => {
        if (lc.course_id) {
            countsMap.set(lc.course_id, lc._count.id);
        }
    });

    const data: CourseDTO[] = courses.map(course => ({
        id: course.id,
        title: course.title,
        description: course.description,
        image: course.image,
        order_no: course.order_no,
        lesson_count: countsMap.get(course.id) || 0,
    }));

    const totalPages = Math.ceil(total / query.limit);
    const result = {
        success: true,
        data,
        meta: {
            page: query.page,
            limit: query.limit,
            total,
            total_pages: totalPages || 1,
        },
    };

    // Cache kết quả trong 30 phút (1800 giây)
    memoryCache.set(cacheKey, result, 1800);

    return result;
}

/**
 * Lấy thông tin chi tiết một khóa học (Public)
 * Tích hợp Cache 30 phút
 */
export async function getCourseDetail(courseId: string) {
    const cacheKey = `courses:detail:${courseId}`;
    const cachedData = memoryCache.get(cacheKey);

    if (cachedData) {
        return cachedData;
    }

    const course = await courseRepository.findCourseById(courseId);
    if (!course) {
        throw new Error("COURSE_NOT_FOUND");
    }

    const lessons = await courseRepository.findLessonsByCourseId(courseId);

    const data: CourseDetailDTO = {
        id: course.id,
        title: course.title,
        description: course.description,
        image: course.image,
        lessons: lessons.map(l => ({
            id: l.id,
            title: l.title,
            description: l.description,
            order_no: l.order_no,
        })),
    };

    const result = {
        success: true,
        data,
    };

    // Cache kết quả trong 30 phút (1800 giây)
    memoryCache.set(cacheKey, result, 1800);

    return result;
}

/**
 * Tạo khóa học mới (Admin)
 * Hủy bỏ cache danh sách
 */
export async function createCourse(adminId: string, data: CreateCourseBody) {
    const newCourse = await db.prisma.$transaction(async (tx) => {
        const course = await courseRepository.createCourse(tx, {
            title: data.title,
            description: data.description,
            image: data.image,
            order_no: data.order_no,
        });

        // Ghi nhận log kiểm toán
        await adminRepository.createAuditLog(tx, {
            adminId,
            action: "course.created",
            entityId: course.id,
            afterState: course,
        });

        return course;
    });

    // Invalidate cache
    memoryCache.deletePattern("courses:list:*");

    return {
        success: true,
        data: {
            id: newCourse.id,
            title: newCourse.title,
            order_no: newCourse.order_no,
        },
        message: "Course created successfully.",
    };
}

/**
 * Cập nhật khóa học (Admin)
 * Hủy bỏ cache danh sách và cache chi tiết
 */
export async function updateCourse(adminId: string, courseId: string, data: UpdateCourseBody) {
    const course = await courseRepository.findCourseById(courseId);
    if (!course) {
        throw new Error("COURSE_NOT_FOUND");
    }

    const updatedCourse = await db.prisma.$transaction(async (tx) => {
        const updated = await courseRepository.updateCourse(tx, courseId, {
            title: data.title,
            description: data.description,
            image: data.image,
            order_no: data.order_no,
        });

        // Ghi nhận log kiểm toán
        await adminRepository.createAuditLog(tx, {
            adminId,
            action: "course.updated",
            entityId: courseId,
            beforeState: course,
            afterState: data,
        });

        return updated;
    });

    // Invalidate cache
    memoryCache.deletePattern("courses:list:*");
    memoryCache.delete(`courses:detail:${courseId}`);

    return {
        success: true,
        data: {
            id: updatedCourse.id,
            title: updatedCourse.title,
        },
        message: "Course updated successfully.",
    };
}

/**
 * Xóa mềm khóa học (Admin)
 * Kiểm tra tính toàn vẹn (refuse nếu còn bài học con)
 */
export async function deleteCourse(adminId: string, courseId: string) {
    await db.prisma.$transaction(async (tx) => {
        // SELECT FOR UPDATE giả lập trong Prisma thông qua queryRaw hoặc fetch kiểm tra tồn tại
        // Để chống race condition: kiểm tra sự tồn tại của khóa học trước
        const course = await courseRepository.findCourseById(courseId, false, tx);

        if (!course || course.deleted_at !== null) {
            throw new Error("COURSE_NOT_FOUND");
        }

        // Đếm số lượng bài học còn liên kết
        const lessonCount = await courseRepository.countLessonsInCourse(courseId, tx);
        if (lessonCount > 0) {
            throw new Error("COURSE_NOT_EMPTY");
        }

        // Xóa mềm khóa học
        await courseRepository.softDeleteCourse(tx, courseId);

        // Ghi nhận log kiểm toán
        await adminRepository.createAuditLog(tx, {
            adminId,
            action: "course.deleted",
            entityId: courseId,
            beforeState: course,
        });
    });

    // Invalidate cache
    memoryCache.deletePattern("courses:list:*");
    memoryCache.delete(`courses:detail:${courseId}`);

    return {
        success: true,
        message: "Course deleted successfully.",
    };
}

/**
 * Khôi phục khóa học bị xóa mềm (Admin)
 */
export async function restoreCourse(adminId: string, courseId: string) {
    const course = await courseRepository.findCourseById(courseId, true); // Bao gồm cả khóa học đã bị xóa
    if (!course) {
        throw new Error("COURSE_NOT_FOUND");
    }

    await db.prisma.$transaction(async (tx) => {
        // Khôi phục khóa học
        await courseRepository.restoreCourse(tx, courseId);

        // Ghi nhận log kiểm toán
        await adminRepository.createAuditLog(tx, {
            adminId,
            action: "course.restored",
            entityId: courseId,
            afterState: { id: courseId, deleted_at: null },
        });
    });

    // Invalidate cache
    memoryCache.deletePattern("courses:list:*");
    memoryCache.delete(`courses:detail:${courseId}`);

    return {
        success: true,
        message: "Course restored successfully.",
    };
}
