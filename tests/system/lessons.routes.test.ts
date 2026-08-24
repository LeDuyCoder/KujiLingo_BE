import { test, mock, beforeEach } from "node:test";
import assert from "node:assert";
import app from "../../src/app.js";
import { lessonsRepository } from "../../src/modules/lessons/lessons.repository.js";
import { authRepository } from "../../src/modules/auth/auth.repository.js";
import { adminRepository } from "../../src/modules/admin/admin.repository.js";
import { signToken } from "../../src/common/utils/jwt.js";

test("Lessons Routes - System Tests", async (t) => {
    const adminUserId = "723b10b0-394e-4f7f-85db-e877de25272a";
    const regularUserId = "11111111-2222-4333-8444-555555555555";
    let adminToken: string;
    let userToken: string;

    beforeEach(async () => {
        mock.restoreAll();
        await app.ready();

        adminToken = signToken({ sub: adminUserId, role: "admin" });
        userToken = signToken({ sub: regularUserId, role: "user" });

        // Mock authRepository.findUserById
        mock.method(authRepository, "findUserById", async (id: string) => {
            if (id === adminUserId) {
                return { id: adminUserId, email: "admin@example.com", role: "admin", status: "active" };
            }
            if (id === regularUserId) {
                return { id: regularUserId, email: "user@example.com", role: "user", status: "active" };
            }
            return null;
        });
    });

    await t.test("GET /api/v1/lessons/{id} - returns 200 with lesson details (Public)", async () => {
        mock.method(lessonsRepository, "findLessonDetail", async () => ({
            id: "723b10b0-394e-4f7f-85db-e877de25272a",
            course_id: "10000000-0000-4000-8000-000000000001",
            title: "Greetings",
            description: "Say hello",
            topics: []
        }));

        const response = await app.inject({
            method: "GET",
            url: "/api/v1/lessons/723b10b0-394e-4f7f-85db-e877de25272a",
        });

        if (response.statusCode !== 200) {
            console.error("GET DETAIL ERROR PAYLOAD:", response.payload);
        }
        assert.strictEqual(response.statusCode, 200);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.title, "Greetings");
    });

    await t.test("GET /api/v1/lessons/{id} - returns 400 if ID is not a valid UUID", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/lessons/invalid-uuid",
        });

        assert.strictEqual(response.statusCode, 400);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, false);
        assert.strictEqual(body.error.code, "VALIDATION_ERROR");
    });

    await t.test("POST /api/v1/admin/lessons - returns 401 if unauthenticated", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/admin/lessons",
            headers: { "content-type": "application/json" },
            payload: JSON.stringify({ course_id: "10000000-0000-4000-8000-000000000001", title: "New Lesson" })
        });

        assert.strictEqual(response.statusCode, 401);
    });

    await t.test("POST /api/v1/admin/lessons - returns 403 if role is not admin", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/admin/lessons",
            headers: { authorization: `Bearer ${userToken}`, "content-type": "application/json" },
            payload: JSON.stringify({ course_id: "10000000-0000-4000-8000-000000000001", title: "New Lesson" })
        });

        assert.strictEqual(response.statusCode, 403);
    });

    await t.test("POST /api/v1/admin/lessons - returns 201 on success (Admin)", async () => {
        mock.method(lessonsRepository, "checkCourseExists", async () => true);
        mock.method(lessonsRepository, "insertLesson", async () => ({
            id: "20000000-0000-4000-8000-000000000002",
            course_id: "10000000-0000-4000-8000-000000000001",
            title: "Greetings",
            order_no: 1
        }));
        mock.method(adminRepository, "createAuditLog", async () => ({}));

        const response = await app.inject({
            method: "POST",
            url: "/api/v1/admin/lessons",
            headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
            payload: JSON.stringify({ course_id: "10000000-0000-4000-8000-000000000001", title: "Greetings", order_no: 1 })
        });

        if (response.statusCode !== 201) {
            console.error("CREATE LESSON ERROR PAYLOAD:", response.payload);
        }
        assert.strictEqual(response.statusCode, 201);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.title, "Greetings");
    });

    await t.test("PUT /api/v1/admin/lessons/{id} - returns 400 on empty update", async () => {
        const response = await app.inject({
            method: "PUT",
            url: "/api/v1/admin/lessons/723b10b0-394e-4f7f-85db-e877de25272a",
            headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
            payload: JSON.stringify({})
        });

        assert.strictEqual(response.statusCode, 400);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.error.code, "EMPTY_UPDATE");
    });

    await t.test("DELETE /api/v1/admin/lessons/{id} - returns 409 Conflict if lesson not empty", async () => {
        mock.method(lessonsRepository, "findById", async () => ({ id: "723b10b0-394e-4f7f-85db-e877de25272a", course_id: "course-1" }));
        mock.method(lessonsRepository, "countTopicsByLessonId", async () => 5);

        const response = await app.inject({
            method: "DELETE",
            url: "/api/v1/admin/lessons/723b10b0-394e-4f7f-85db-e877de25272a",
            headers: { authorization: `Bearer ${adminToken}` }
        });

        assert.strictEqual(response.statusCode, 409);
        const body = JSON.parse(response.payload);
        assert.strictEqual(body.error.code, "LESSON_NOT_EMPTY");
    });
});
