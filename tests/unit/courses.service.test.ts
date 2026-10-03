import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import * as coursesService from "../../src/modules/courses/courses.service.js";
import { courseRepository } from "../../src/modules/courses/courses.repository.js";
import { adminRepository } from "../../src/modules/admin/admin.repository.js";
import { memoryCache } from "../../src/common/utils/cache.js";
import { db } from "../../src/config/prisma.js";

const originalPrisma = db.prisma;

test("Courses Service - Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
        memoryCache.clear();
        
        // Bypassing Prisma's dynamic Proxy restrictions
        db.prisma = {
            courses: originalPrisma.courses,
            $transaction: async (callback: any) => {
                return callback(db.prisma);
            }
        } as any;
    });

    afterEach(() => {
        db.prisma = originalPrisma;
    });

    await t.test("listCourses - success and caching", async () => {
        const mockCourses = [
            {
                id: "course-1",
                title: "N5 Course",
                description: "Desc",
                image: "img",
                order_no: 1,
                deleted_at: null,
            }
        ];

        const mockCounts = [
            {
                course_id: "course-1",
                _count: { id: 5 },
            }
        ];

        const findManyMock = mock.method(courseRepository, "findManyCourses", async () => mockCourses);
        const countAllMock = mock.method(courseRepository, "countAllCourses", async () => 1);
        const countLessonsMock = mock.method(courseRepository, "countLessonsByCourses", async () => mockCounts);

        // First call - cache miss
        const res1 = await coursesService.listCourses({ page: 1, limit: 20 });
        assert.strictEqual(res1.success, true);
        assert.strictEqual(res1.data.length, 1);
        assert.strictEqual(res1.data[0].lesson_count, 5);
        assert.strictEqual(findManyMock.mock.callCount(), 1);

        // Second call - cache hit
        const res2 = await coursesService.listCourses({ page: 1, limit: 20 });
        assert.deepStrictEqual(res2, res1);
        assert.strictEqual(findManyMock.mock.callCount(), 1); // should not be called again
    });

    await t.test("getCourseDetail - success, 404, and caching", async () => {
        const mockCourse = {
            id: "course-1",
            title: "N5 Course",
            description: "Desc",
            image: "img",
            order_no: 1,
            deleted_at: null,
        };

        const mockLessons = [
            { id: "lesson-1", title: "Greeting", description: "Hello", order_no: 1 },
        ];

        const findByIdMock = mock.method(courseRepository, "findCourseById", async () => mockCourse);
        const findLessonsMock = mock.method(courseRepository, "findLessonsByCourseId", async () => mockLessons);

        // First call - cache miss
        const res1 = await coursesService.getCourseDetail("course-1");
        assert.strictEqual(res1.success, true);
        assert.strictEqual(res1.data.lessons.length, 1);
        assert.strictEqual(findByIdMock.mock.callCount(), 1);

        // Second call - cache hit
        const res2 = await coursesService.getCourseDetail("course-1");
        assert.deepStrictEqual(res2, res1);
        assert.strictEqual(findByIdMock.mock.callCount(), 1); // should not be called again

        // Non-existent course
        mock.restoreAll();
        mock.method(courseRepository, "findCourseById", async () => null);
        await assert.rejects(
            coursesService.getCourseDetail("course-2"),
            /COURSE_NOT_FOUND/
        );
    });

    await t.test("createCourse - success", async () => {
        const mockCourse = { id: "course-new", title: "New Course", order_no: 5 };

        const createMock = mock.method(courseRepository, "createCourse", async () => mockCourse);
        const auditLogMock = mock.method(adminRepository, "createAuditLog", async () => ({}));
        const cacheDeletePatternMock = mock.method(memoryCache, "deletePattern");

        const res = await coursesService.createCourse("admin-1", {
            title: "New Course",
            order_no: 5,
        });

        assert.strictEqual(res.success, true);
        assert.strictEqual(res.data.id, "course-new");
        assert.strictEqual(createMock.mock.callCount(), 1);
        assert.strictEqual(auditLogMock.mock.callCount(), 1);
        assert.strictEqual(cacheDeletePatternMock.mock.callCount(), 1);
    });

    await t.test("updateCourse - success and 404", async () => {
        const mockCourse = { id: "course-1", title: "Old Course", order_no: 1 };
        const mockUpdated = { id: "course-1", title: "Updated Course" };

        mock.method(courseRepository, "findCourseById", async () => mockCourse);
        const updateMock = mock.method(courseRepository, "updateCourse", async () => mockUpdated);
        const auditLogMock = mock.method(adminRepository, "createAuditLog", async () => ({}));
        const cacheDeleteMock = mock.method(memoryCache, "delete");

        const res = await coursesService.updateCourse("admin-1", "course-1", {
            title: "Updated Course",
        });

        assert.strictEqual(res.success, true);
        assert.strictEqual(res.data.title, "Updated Course");
        assert.strictEqual(updateMock.mock.callCount(), 1);
        assert.strictEqual(auditLogMock.mock.callCount(), 1);
        assert.strictEqual(cacheDeleteMock.mock.callCount(), 1); // deletes detail cache

        // 404
        mock.restoreAll();
        mock.method(courseRepository, "findCourseById", async () => null);
        await assert.rejects(
            coursesService.updateCourse("admin-1", "course-1", { title: "Any" }),
            /COURSE_NOT_FOUND/
        );
    });

    await t.test("deleteCourse - success, 404, 409", async () => {
        const mockCourse = { id: "course-1", title: "Course", order_no: 1, deleted_at: null };

        // 1. Success (empty course)
        const findByIdMock = mock.method(courseRepository, "findCourseById", async () => mockCourse);
        mock.method(courseRepository, "countLessonsInCourse", async () => 0);
        const softDeleteMock = mock.method(courseRepository, "softDeleteCourse", async () => ({}));
        const auditLogMock = mock.method(adminRepository, "createAuditLog", async () => ({}));

        const res = await coursesService.deleteCourse("admin-1", "course-1");
        assert.strictEqual(res.success, true);
        assert.strictEqual(softDeleteMock.mock.callCount(), 1);
        assert.strictEqual(auditLogMock.mock.callCount(), 1);

        // 2. 404 (already deleted or doesn't exist)
        mock.restoreAll();
        mock.method(courseRepository, "findCourseById", async () => null);
        await assert.rejects(
            coursesService.deleteCourse("admin-1", "course-1"),
            /COURSE_NOT_FOUND/
        );

        // 3. 409 (not empty)
        mock.restoreAll();
        mock.method(courseRepository, "findCourseById", async () => mockCourse);
        mock.method(courseRepository, "countLessonsInCourse", async () => 3); // has 3 lessons
        await assert.rejects(
            coursesService.deleteCourse("admin-1", "course-1"),
            /COURSE_NOT_EMPTY/
        );
    });

    await t.test("restoreCourse - success and 404", async () => {
        const mockCourse = { id: "course-1", title: "Course", order_no: 1, deleted_at: new Date() };

        mock.method(courseRepository, "findCourseById", async () => mockCourse);
        const restoreMock = mock.method(courseRepository, "restoreCourse", async () => ({}));
        const auditLogMock = mock.method(adminRepository, "createAuditLog", async () => ({}));

        const res = await coursesService.restoreCourse("admin-1", "course-1");
        assert.strictEqual(res.success, true);
        assert.strictEqual(restoreMock.mock.callCount(), 1);
        assert.strictEqual(auditLogMock.mock.callCount(), 1);

        // 404
        mock.restoreAll();
        mock.method(courseRepository, "findCourseById", async () => null);
        await assert.rejects(
            coursesService.restoreCourse("admin-1", "course-1"),
            /COURSE_NOT_FOUND/
        );
    });
});
