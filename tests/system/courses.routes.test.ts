import { test, beforeEach, after } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { memoryCache } from "../../src/common/utils/cache.js";

async function clearDatabase() {
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

    const loginRes = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password },
    });

    const body = JSON.parse(loginRes.body);
    return {
        id: userId,
        token: body.data.access_token,
    };
}

test("Courses API - Database Integration Tests", async (t) => {
    beforeEach(async () => {
        await clearDatabase();
        memoryCache.clear();
    });

    after(async () => {
        await clearDatabase();
        memoryCache.clear();
    });

    await t.test("GET /courses - success and order_no check", async () => {
        // Create 2 courses with specific order_no
        const c1Id = crypto.randomUUID();
        const c2Id = crypto.randomUUID();

        await prisma.courses.createMany({
            data: [
                { id: c1Id, title: "Course 2", order_no: 2 },
                { id: c2Id, title: "Course 1", order_no: 1 },
            ]
        });

        // Add 3 lessons to Course 1 and 0 to Course 2
        await prisma.lessons.createMany({
            data: [
                { id: crypto.randomUUID(), course_id: c2Id, title: "L1", order_no: 1 },
                { id: crypto.randomUUID(), course_id: c2Id, title: "L2", order_no: 2 },
                { id: crypto.randomUUID(), course_id: c2Id, title: "L3", order_no: 3 },
            ]
        });

        const response = await app.inject({
            method: "GET",
            url: "/courses",
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.length, 2);

        // Course 1 (order_no: 1) should be first
        assert.strictEqual(body.data[0].id, c2Id);
        assert.strictEqual(body.data[0].title, "Course 1");
        assert.strictEqual(body.data[0].lesson_count, 3);

        // Course 2 (order_no: 2) should be second
        assert.strictEqual(body.data[1].id, c1Id);
        assert.strictEqual(body.data[1].title, "Course 2");
        assert.strictEqual(body.data[1].lesson_count, 0);
    });

    await t.test("GET /courses/:id - success and 404", async () => {
        const cId = crypto.randomUUID();
        await prisma.courses.create({
            data: { id: cId, title: "Foundations", order_no: 1 },
        });

        // Add lessons
        const lId = crypto.randomUUID();
        await prisma.lessons.create({
            data: { id: lId, course_id: cId, title: "Lesson 1", order_no: 1 },
        });

        const resFound = await app.inject({
            method: "GET",
            url: `/courses/${cId}`,
        });

        assert.strictEqual(resFound.statusCode, 200);
        const bodyFound = JSON.parse(resFound.body);
        assert.strictEqual(bodyFound.data.title, "Foundations");
        assert.strictEqual(bodyFound.data.lessons.length, 1);
        assert.strictEqual(bodyFound.data.lessons[0].id, lId);

        // 404
        const resNotFound = await app.inject({
            method: "GET",
            url: `/courses/${crypto.randomUUID()}`,
        });
        assert.strictEqual(resNotFound.statusCode, 404);
    });

    await t.test("POST /admin/courses - admin success, regular user forbidden", async () => {
        const admin = await createAuthenticatedUser("admin@example.com", "admin");
        const regular = await createAuthenticatedUser("user@example.com", "user");

        // 1. Regular user should receive 403
        const resRegular = await app.inject({
            method: "POST",
            url: "/admin/courses",
            headers: { Authorization: `Bearer ${regular.token}` },
            payload: { title: "Forbidden Course" },
        });
        assert.strictEqual(resRegular.statusCode, 403);

        // 2. Admin should receive 201
        const resAdmin = await app.inject({
            method: "POST",
            url: "/admin/courses",
            headers: { Authorization: `Bearer ${admin.token}` },
            payload: { title: "Allowed Course", description: "Desc", order_no: 5 },
        });
        assert.strictEqual(resAdmin.statusCode, 201);
        const bodyAdmin = JSON.parse(resAdmin.body);
        assert.strictEqual(bodyAdmin.success, true);
        assert.strictEqual(bodyAdmin.data.title, "Allowed Course");

        // Verify DB course insert
        const dbCourse = await prisma.courses.findUnique({ where: { id: bodyAdmin.data.id } });
        assert.ok(dbCourse);
        assert.strictEqual(dbCourse.description, "Desc");

        // Verify Audit Log
        const dbLog = await prisma.admin_audit_logs.findFirst({ where: { admin_id: admin.id } });
        assert.ok(dbLog);
        assert.strictEqual(dbLog.action, "course.created");
    });

    await t.test("PUT /admin/courses/:id - success update", async () => {
        const admin = await createAuthenticatedUser("admin@example.com", "admin");
        const cId = crypto.randomUUID();
        await prisma.courses.create({
            data: { id: cId, title: "Original Name", order_no: 1 },
        });

        const response = await app.inject({
            method: "PUT",
            url: `/admin/courses/${cId}`,
            headers: { Authorization: `Bearer ${admin.token}` },
            payload: { title: "Updated Name" },
        });

        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.body);
        assert.strictEqual(body.data.title, "Updated Name");

        // Verify DB
        const dbCourse = await prisma.courses.findUnique({ where: { id: cId } });
        assert.strictEqual(dbCourse?.title, "Updated Name");
    });

    await t.test("DELETE /admin/courses/:id - soft delete success, restore and 409 conflict", async () => {
        const admin = await createAuthenticatedUser("admin@example.com", "admin");
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
