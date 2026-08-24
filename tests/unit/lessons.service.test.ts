import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { lessonsService } from "../../src/modules/lessons/lessons.service.js";
import { lessonsRepository } from "../../src/modules/lessons/lessons.repository.js";
import { adminRepository } from "../../src/modules/admin/admin.repository.js";
import { memoryCache } from "../../src/common/utils/cache.js";

test("Lessons Service - Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
        memoryCache.clear();
    });

    afterEach(() => {
        memoryCache.clear();
    });

    await t.test("getLessonDetail - returns lesson detail with topics sorted by order_no", async () => {
        const mockLesson = {
            id: "lesson-1",
            course_id: "course-1",
            title: "Lesson Title",
            description: "Lesson Desc",
            topics: [
                { id: "topic-1", title: "Topic 1", description: "Desc 1", image: "img1.png", order_no: 1 },
                { id: "topic-2", title: "Topic 2", description: "Desc 2", image: null, order_no: 2 }
            ]
        };

        const findMock = mock.method(lessonsRepository, "findLessonDetail", async () => mockLesson);

        // 1st request (cache miss)
        const result1 = await lessonsService.getLessonDetail("lesson-1");
        assert.strictEqual(result1.success, true);
        assert.strictEqual(result1.data.id, "lesson-1");
        assert.strictEqual(result1.data.topics.length, 2);
        // Assert topics are mapped correctly and ordered by order_no ASC
        assert.strictEqual(result1.data.topics[0].id, "topic-1");
        assert.strictEqual(result1.data.topics[1].id, "topic-2");
        assert.strictEqual(findMock.mock.callCount(), 1);

        // 2nd request (cache hit)
        const result2 = await lessonsService.getLessonDetail("lesson-1");
        assert.deepStrictEqual(result1, result2);
        assert.strictEqual(findMock.mock.callCount(), 1); // should still be 1
    });

    await t.test("getLessonDetail - throws LESSON_NOT_FOUND if lesson missing", async () => {
        mock.method(lessonsRepository, "findLessonDetail", async () => null);

        await assert.rejects(
            lessonsService.getLessonDetail("missing-id"),
            (err: any) => {
                assert.strictEqual(err.message, "LESSON_NOT_FOUND");
                return true;
            }
        );
    });

    await t.test("createLesson - creates lesson successfully and invalidates cache", async () => {
        const createdLesson = { id: "lesson-created", course_id: "course-1", title: "New Lesson", order_no: 5 };

        mock.method(lessonsRepository, "checkCourseExists", async () => true);
        const insertMock = mock.method(lessonsRepository, "insertLesson", async () => createdLesson);
        const auditMock = mock.method(adminRepository, "createAuditLog", async () => ({}));

        const cacheDeletePatternMock = mock.method(memoryCache, "deletePattern");
        const cacheDeleteMock = mock.method(memoryCache, "delete");

        const result = await lessonsService.createLesson("admin-id", {
            course_id: "course-1",
            title: "New Lesson",
            description: "Description text",
            order_no: 5
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.id, "lesson-created");
        assert.strictEqual(insertMock.mock.callCount(), 1);
        assert.strictEqual(auditMock.mock.callCount(), 1);

        // Verify cache invalidations
        assert.strictEqual(cacheDeletePatternMock.mock.callCount(), 1);
        assert.strictEqual(cacheDeleteMock.mock.callCount(), 1);
        assert.strictEqual(cacheDeleteMock.mock.calls[0].arguments[0], "courses:detail:course-1");
    });

    await t.test("createLesson - throws INVALID_COURSE_REFERENCE if parent course missing", async () => {
        mock.method(lessonsRepository, "checkCourseExists", async () => false);

        await assert.rejects(
            lessonsService.createLesson("admin-id", { course_id: "missing-course", title: "New Lesson" }),
            (err: any) => {
                assert.strictEqual(err.message, "INVALID_COURSE_REFERENCE");
                return true;
            }
        );
    });

    await t.test("updateLesson - updates lesson successfully and invalidates caches", async () => {
        const oldLesson = { id: "lesson-id", course_id: "course-1", title: "Old Title", description: null, order_no: 0 };
        const updatedLesson = { id: "lesson-id", course_id: "course-1", title: "Updated Title", description: null, order_no: 0 };

        mock.method(lessonsRepository, "findById", async () => oldLesson);
        const updateMock = mock.method(lessonsRepository, "updateLesson", async () => updatedLesson);
        mock.method(adminRepository, "createAuditLog", async () => ({}));

        const result = await lessonsService.updateLesson("admin-id", "lesson-id", {
            title: "Updated Title"
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.title, "Updated Title");
        assert.strictEqual(updateMock.mock.callCount(), 1);
    });

    await t.test("updateLesson - throws EMPTY_UPDATE if no fields provided", async () => {
        await assert.rejects(
            lessonsService.updateLesson("admin-id", "lesson-id", {}),
            (err: any) => {
                assert.strictEqual(err.message, "EMPTY_UPDATE");
                return true;
            }
        );
    });

    await t.test("deleteLesson - deletes lesson successfully if it has no topics", async () => {
        const oldLesson = { id: "lesson-id", course_id: "course-1", title: "Lesson Title" };

        mock.method(lessonsRepository, "findById", async () => oldLesson);
        mock.method(lessonsRepository, "countTopicsByLessonId", async () => 0);
        const deleteMock = mock.method(lessonsRepository, "deleteLesson", async () => ({}));
        mock.method(adminRepository, "createAuditLog", async () => ({}));

        const result = await lessonsService.deleteLesson("admin-id", "lesson-id");

        assert.strictEqual(result.success, true);
        assert.strictEqual(deleteMock.mock.callCount(), 1);
    });

    await t.test("deleteLesson - throws LESSON_NOT_EMPTY if it has child topics", async () => {
        const oldLesson = { id: "lesson-id", course_id: "course-1", title: "Lesson Title" };

        mock.method(lessonsRepository, "findById", async () => oldLesson);
        mock.method(lessonsRepository, "countTopicsByLessonId", async () => 3);

        await assert.rejects(
            lessonsService.deleteLesson("admin-id", "lesson-id"),
            (err: any) => {
                assert.strictEqual(err.message, "LESSON_NOT_EMPTY");
                return true;
            }
        );
    });
});
