import { test, before, after } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { memoryCache } from "../../src/common/utils/cache.js";
import { signToken } from "../../src/common/utils/jwt.js";

async function clearDatabase() {
    await prisma.favorite_vocabularies.deleteMany({});
    await prisma.grammar_points.deleteMany({});
    await prisma.payment_transactions.deleteMany({});
    await prisma.wallet_histories.deleteMany({});
    await prisma.user_wallets.deleteMany({});
    await prisma.user_achievements.deleteMany({});
    await prisma.learning_progress.deleteMany({});
    await prisma.review_histories.deleteMany({});
    await prisma.user_vocabularies.deleteMany({});
    await prisma.user_shop_items.deleteMany({});
    await prisma.user_equipped_items.deleteMany({});
    await prisma.user_statistics_daily.deleteMany({});
    await prisma.admin_audit_logs.deleteMany({});
    await prisma.login_attempts.deleteMany({});
    await prisma.refresh_tokens.deleteMany({});
    await prisma.password_reset_tokens.deleteMany({});
    await prisma.email_verification_tokens.deleteMany({});
    await prisma.lessons.deleteMany({});
    await prisma.courses.deleteMany({});
    await prisma.users.deleteMany({});
}

async function createAuthenticatedUser(email: string, role: string = "user") {
    await app.ready();
    const password = "Password123";
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await prisma.users.create({
        data: {
            id: userId,
            email,
            password_hash: passwordHash,
            display_name: `Test ${role}`,
            status: "active",
            role,
            email_verified: true,
        },
    });

    const token = signToken({ sub: userId, role });
    return {
        id: userId,
        token,
    };
}

test("Courses API - Database Integration Tests", async (t) => {
    before(async () => {
        await app.ready();
    });

    after(async () => {
        await clearDatabase();
        await memoryCache.clear();
    });

    await t.test("GET /courses - success and order_no check", async () => {
        await clearDatabase();
        await memoryCache.clear();
        await prisma.courses.createMany({
            data: [
                { id: crypto.randomUUID(), title: "Course N4", order_no: 2 },
                { id: crypto.randomUUID(), title: "Course N5", order_no: 1 },
            ],
        });

        const response = await app.inject({
            method: "GET",
            url: "/courses",
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.length, 2);
        assert.strictEqual(body.data[0].title, "Course N5");
        assert.strictEqual(body.data[1].title, "Course N4");
    });

    await t.test("GET /courses/:id - success and 404", async () => {
        await clearDatabase();
        await memoryCache.clear();
        const courseId = crypto.randomUUID();
        const lessonId = crypto.randomUUID();

        await prisma.courses.create({
            data: {
                id: courseId,
                title: "Course Detail Test",
                order_no: 1,
                lessons: {
                    create: [
                        { id: lessonId, title: "Lesson 1", order_no: 1 },
                    ],
                },
            },
        });

        // 1. Existing Course
        const resSuccess = await app.inject({
            method: "GET",
            url: `/courses/${courseId}`,
        });
        assert.strictEqual(resSuccess.statusCode, 200);
        const bodySuccess = JSON.parse(resSuccess.body);
        assert.strictEqual(bodySuccess.data.id, courseId);
        assert.strictEqual(bodySuccess.data.lessons.length, 1);
        assert.strictEqual(bodySuccess.data.lessons[0].id, lessonId);

        // 2. Non-existing Course -> 404
        const resNotFound = await app.inject({
            method: "GET",
            url: `/courses/${crypto.randomUUID()}`,
        });
        assert.strictEqual(resNotFound.statusCode, 404);
        const bodyNotFound = JSON.parse(resNotFound.body);
        assert.strictEqual(bodyNotFound.error.code, "COURSE_NOT_FOUND");
    });

    await t.test("POST /admin/courses - admin success, regular user forbidden", async () => {
        await clearDatabase();
        await memoryCache.clear();
        const admin = await createAuthenticatedUser("admin.course@example.com", "admin");
        const regularUser = await createAuthenticatedUser("user.course@example.com", "user");

        // 1. Regular user creates course -> 403 Forbidden
        const resForbidden = await app.inject({
            method: "POST",
            url: "/admin/courses",
            headers: { Authorization: `Bearer ${regularUser.token}` },
            payload: {
                title: "Unauthorized Course",
                description: "Test Desc",
            },
        });
        assert.strictEqual(resForbidden.statusCode, 403);

        // 2. Admin creates course -> 201 Created
        const resSuccess = await app.inject({
            method: "POST",
            url: "/admin/courses",
            headers: { Authorization: `Bearer ${admin.token}` },
            payload: {
                title: "New Admin Course",
                description: "Test Desc",
                target_level: "N3",
                thumbnail_url: "https://example.com/thumb.png",
                order_no: 10,
            },
        });

        assert.strictEqual(resSuccess.statusCode, 201);
        const bodySuccess = JSON.parse(resSuccess.body);
        assert.strictEqual(bodySuccess.success, true);
        assert.strictEqual(bodySuccess.data.title, "New Admin Course");
        assert.strictEqual(bodySuccess.data.order_no, 10);

        // Verify audit log
        const logs = await prisma.admin_audit_logs.findMany({
            where: { admin_id: admin.id },
        });
        assert.strictEqual(logs.length, 1);
        assert.strictEqual(logs[0].action, "course.created");
    });

    await t.test("PUT /admin/courses/:id - success update", async () => {
        await clearDatabase();
        await memoryCache.clear();
        const admin = await createAuthenticatedUser("admin.course2@example.com", "admin");
        const cId = crypto.randomUUID();

        await prisma.courses.create({
            data: { id: cId, title: "Original Name", order_no: 1 },
        });

        const resUpdate = await app.inject({
            method: "PUT",
            url: `/admin/courses/${cId}`,
            headers: { Authorization: `Bearer ${admin.token}` },
            payload: {
                title: "Updated Name",
            },
        });

        assert.strictEqual(resUpdate.statusCode, 200);
        const bodyUpdate = JSON.parse(resUpdate.body);
        assert.strictEqual(bodyUpdate.data.title, "Updated Name");

        // Verify DB
        const dbCourse = await prisma.courses.findUnique({ where: { id: cId } });
        assert.strictEqual(dbCourse?.title, "Updated Name");
    });

    await t.test("DELETE /admin/courses/:id - soft delete success, restore and 409 conflict", async () => {
        await clearDatabase();
        await memoryCache.clear();
        const admin = await createAuthenticatedUser("admin.course3@example.com", "admin");
        const cId = crypto.randomUUID();
        await prisma.courses.create({
            data: { id: cId, title: "Target Course", order_no: 1 },
        });

        // 1. Try to delete a course with lessons -> 409 Conflict
        const lId = crypto.randomUUID();
        await prisma.lessons.create({
            data: { id: lId, course_id: cId, title: "L1", order_no: 1 }
        });

        const resConflict = await app.inject({
            method: "DELETE",
            url: `/admin/courses/${cId}`,
            headers: { Authorization: `Bearer ${admin.token}` },
        });
        assert.strictEqual(resConflict.statusCode, 409);
        const bodyConflict = JSON.parse(resConflict.body);
        assert.strictEqual(bodyConflict.error.code, "COURSE_NOT_EMPTY");

        // 2. Remove lessons, try again -> 200 OK (soft delete)
        await prisma.lessons.delete({ where: { id: lId } });

        const resDelete = await app.inject({
            method: "DELETE",
            url: `/admin/courses/${cId}`,
            headers: { Authorization: `Bearer ${admin.token}` },
        });
        assert.strictEqual(resDelete.statusCode, 200);

        // Verify DB row exists with deleted_at != null (Soft Deleted)
        const dbCourseAfterDelete = await prisma.courses.findUnique({ where: { id: cId } });
        assert.ok(dbCourseAfterDelete);
        assert.ok(dbCourseAfterDelete.deleted_at);

        // Public lists should hide this course
        const resPublicList = await app.inject({
            method: "GET",
            url: "/courses",
        });
        const bodyPublicList = JSON.parse(resPublicList.body);
        assert.strictEqual(bodyPublicList.data.length, 0);

        // 3. Restore course -> 200 OK
        const resRestore = await app.inject({
            method: "POST",
            url: `/admin/courses/${cId}/restore`,
            headers: { Authorization: `Bearer ${admin.token}` },
        });
        assert.strictEqual(resRestore.statusCode, 200);

        // Verify DB row deleted_at == null
        const dbCourseAfterRestore = await prisma.courses.findUnique({ where: { id: cId } });
        assert.ok(dbCourseAfterRestore);
        assert.strictEqual(dbCourseAfterRestore.deleted_at, null);

        // Public lists should show the course again
        const resPublicListAgain = await app.inject({
            method: "GET",
            url: "/courses",
        });
        const bodyPublicListAgain = JSON.parse(resPublicListAgain.body);
        assert.strictEqual(bodyPublicListAgain.data.length, 1);
        assert.strictEqual(bodyPublicListAgain.data[0].id, cId);
    });
});
