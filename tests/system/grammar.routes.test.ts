import { test, beforeEach } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";
import { signToken } from "../../src/common/utils/jwt.js";

test("Grammar API System Tests", async (t) => {
    let adminToken: string;
    let userToken: string;
    let adminUserId: string;
    let regularUserId: string;
    let testGrammarId: string;

    beforeEach(async () => {
        // Clear test data
        await prisma.grammar_points.deleteMany({});
        await prisma.admin_audit_logs.deleteMany({});
        await prisma.users.deleteMany({
            where: { email: { in: ["admin_gram_sys@example.com", "user_gram_sys@example.com"] } },
        });

        // Create Admin user
        adminUserId = crypto.randomUUID();
        await prisma.users.create({
            data: {
                id: adminUserId,
                email: "admin_gram_sys@example.com",
                display_name: "Admin Gram Test",
                role: "admin",
                status: "active",
                email_verified: true,
            },
        });
        adminToken = signToken({ sub: adminUserId, role: "admin" });

        // Create Regular user
        regularUserId = crypto.randomUUID();
        await prisma.users.create({
            data: {
                id: regularUserId,
                email: "user_gram_sys@example.com",
                display_name: "Regular User Test",
                role: "user",
                status: "active",
                email_verified: true,
            },
        });
        userToken = signToken({ sub: regularUserId, role: "user" });

        // Insert sample grammar point
        testGrammarId = crypto.randomUUID();
        await prisma.grammar_points.create({
            data: {
                id: testGrammarId,
                title_jp: "〜ば〜ほど",
                structure: "Verb-ば + Verb-る-ほど",
                meaning_vi: "càng... càng...",
                explanation: "Diễn tả mối quan hệ tỷ lệ thuận",
                jlpt_level: "N3",
                example_sentences: [
                    { jp: "勉強すればするほど、上手になります。", vi: "Càng học càng giỏi." },
                ],
                created_by: adminUserId,
            },
        });
    });

    await t.test("GET /api/v1/grammar - 200 OK list all grammar points", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/grammar",
        });

        assert.strictEqual(response.statusCode, 200);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, true);
        assert.strictEqual(payload.data.length, 1);
        assert.strictEqual(payload.data[0].title_jp, "〜ば〜ほど");
    });

    await t.test("GET /api/v1/grammar - 200 OK filtered by jlpt_level=N3", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/grammar?jlpt_level=N3",
        });

        assert.strictEqual(response.statusCode, 200);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, true);
        assert.strictEqual(payload.data.length, 1);
    });

    await t.test("GET /api/v1/grammar - 400 Bad Request on invalid jlpt_level", async () => {
        const response = await app.inject({
            method: "GET",
            url: "/api/v1/grammar?jlpt_level=INVALID",
        });

        assert.strictEqual(response.statusCode, 400);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, false);
        assert.strictEqual(payload.error.code, "VALIDATION_ERROR");
    });

    await t.test("GET /api/v1/grammar/:id - 200 OK detail", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/v1/grammar/${testGrammarId}`,
        });

        assert.strictEqual(response.statusCode, 200);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, true);
        assert.strictEqual(payload.data.id, testGrammarId);
        assert.strictEqual(payload.data.example_sentences.length, 1);
    });

    await t.test("GET /api/v1/grammar/:id - 404 Not Found", async () => {
        const fakeId = crypto.randomUUID();
        const response = await app.inject({
            method: "GET",
            url: `/api/v1/grammar/${fakeId}`,
        });

        assert.strictEqual(response.statusCode, 404);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, false);
        assert.strictEqual(payload.error.code, "GRAMMAR_NOT_FOUND");
    });

    await t.test("POST /api/v1/admin/grammar - 401 Unauthenticated", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/admin/grammar",
            payload: {
                title_jp: "〜てはいけない",
                structure: "Verb-て + はいけない",
                meaning_vi: "không được làm",
                jlpt_level: "N5",
            },
        });

        assert.strictEqual(response.statusCode, 401);
    });

    await t.test("POST /api/v1/admin/grammar - 403 Forbidden for non-admin user", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/admin/grammar",
            headers: {
                authorization: `Bearer ${userToken}`,
            },
            payload: {
                title_jp: "〜てはいけない",
                structure: "Verb-て + はいけない",
                meaning_vi: "không được làm",
                jlpt_level: "N5",
            },
        });

        assert.strictEqual(response.statusCode, 403);
    });

    await t.test("POST /api/v1/admin/grammar - 201 Created by Admin", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/admin/grammar",
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
            payload: {
                title_jp: "〜てはいけない",
                structure: "Verb-て + はいけない",
                meaning_vi: "không được làm",
                jlpt_level: "N5",
            },
        });

        assert.strictEqual(response.statusCode, 201);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, true);
        assert.strictEqual(payload.message, "Grammar point created successfully.");
    });

    await t.test("POST /api/v1/admin/grammar - 409 DUPLICATE_GRAMMAR", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/admin/grammar",
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
            payload: {
                title_jp: "〜ば〜ほど",
                structure: "Verb-ば + Verb-る-ほど",
                meaning_vi: "càng... càng...",
                jlpt_level: "N3",
            },
        });

        assert.strictEqual(response.statusCode, 409);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.error.code, "DUPLICATE_GRAMMAR");
    });

    await t.test("PUT /api/v1/admin/grammar/:id - 200 OK update explanation", async () => {
        const response = await app.inject({
            method: "PUT",
            url: `/api/v1/admin/grammar/${testGrammarId}`,
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
            payload: {
                explanation: "Cấu trúc càng càng phổ biến trong N3.",
            },
        });

        assert.strictEqual(response.statusCode, 200);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, true);
        assert.strictEqual(payload.message, "Grammar point updated successfully.");
    });

    await t.test("DELETE /api/v1/admin/grammar/:id - 200 OK soft delete", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/v1/admin/grammar/${testGrammarId}`,
            headers: {
                authorization: `Bearer ${adminToken}`,
            },
        });

        assert.strictEqual(response.statusCode, 200);
        const payload = JSON.parse(response.payload);
        assert.strictEqual(payload.success, true);
        assert.strictEqual(payload.message, "Grammar point deleted successfully.");

        // Check that detail now returns 404
        const detailRes = await app.inject({
            method: "GET",
            url: `/api/v1/grammar/${testGrammarId}`,
        });
        assert.strictEqual(detailRes.statusCode, 404);
    });
});
