import { test, beforeEach, after } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";

async function clearDatabase() {
    await prisma.folder_system_vocabularies.deleteMany({});
    await prisma.folder_user_vocabularies.deleteMany({});
    await prisma.folders.deleteMany({});
    await prisma.vocabulary_meanings.deleteMany({});
    await prisma.vocabularies.deleteMany({});
    await prisma.user_vocabularies.deleteMany({});
    await prisma.users.deleteMany({});
}

async function createAuthenticatedUser(email: string) {
    const password = "Password123";
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();

    await prisma.users.create({
        data: {
            id: userId,
            email,
            password_hash: passwordHash,
            display_name: "Folder User",
            status: "active",
            role: "user",
            email_verified: true,
        },
    });

    const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password },
    });

    const body = JSON.parse(loginRes.body);
    return {
        id: userId,
        token: body.data.access_token,
    };
}

test("Folder API - Database Integration Tests", async (t) => {
    beforeEach(async () => {
        await clearDatabase();
    });

    after(async () => {
        await clearDatabase();
    });

    await t.test("GET /folders - unauthorized 401", async () => {
        const res = await app.inject({
            method: "GET",
            url: "/api/v1/folders"
        });
        assert.strictEqual(res.statusCode, 401);
    });

    await t.test("POST /folders & GET /folders - create and list folders", async () => {
        const user = await createAuthenticatedUser("user@example.com");

        // 1. Tạo thư mục thứ nhất
        const res1 = await app.inject({
            method: "POST",
            url: "/api/v1/folders",
            headers: { Authorization: `Bearer ${user.token}` },
            payload: { name: "Weak Words", color: "#FF6B6B", icon: "star" }
        });
        assert.strictEqual(res1.statusCode, 201, `res1.body: ${res1.body}`);
        const body1 = JSON.parse(res1.body);
        assert.strictEqual(body1.success, true);
        assert.strictEqual(body1.data.name, "Weak Words");

        // 2. Tạo thư mục thứ hai (để kiểm tra sắp xếp alphabetic)
        const res2 = await app.inject({
            method: "POST",
            url: "/api/v1/folders",
            headers: { Authorization: `Bearer ${user.token}` },
            payload: { name: "Grammar Set", color: "#4ECDC4" }
        });
        assert.strictEqual(res2.statusCode, 201);

        // 3. Lấy danh sách folders
        const listRes = await app.inject({
            method: "GET",
            url: "/api/v1/folders",
            headers: { Authorization: `Bearer ${user.token}` }
        });
        assert.strictEqual(listRes.statusCode, 200);
        const listBody = JSON.parse(listRes.body);
        assert.strictEqual(listBody.success, true);
        assert.strictEqual(listBody.data.length, 2);

        // Sắp xếp Alphabetical name ASC: "Grammar Set" đứng trước "Weak Words"
        assert.strictEqual(listBody.data[0].name, "Grammar Set");
        assert.strictEqual(listBody.data[1].name, "Weak Words");
    });

    await t.test("PUT & DELETE /folders/:id - update and delete folder", async () => {
        const user = await createAuthenticatedUser("user@example.com");

        const folder = await prisma.folders.create({
            data: {
                id: crypto.randomUUID(),
                user_id: user.id,
                name: "Temp Folder",
                color: "#111111"
            }
        });

        // Update
        const updateRes = await app.inject({
            method: "PUT",
            url: `/api/v1/folders/${folder.id}`,
            headers: { Authorization: `Bearer ${user.token}` },
            payload: { name: "Updated Folder" }
        });
        assert.strictEqual(updateRes.statusCode, 200);
        const updateBody = JSON.parse(updateRes.body);
        assert.strictEqual(updateBody.data.name, "Updated Folder");

        // Delete
        const deleteRes = await app.inject({
            method: "DELETE",
            url: `/api/v1/folders/${folder.id}`,
            headers: { Authorization: `Bearer ${user.token}` }
        });
        assert.strictEqual(deleteRes.statusCode, 200);

        // Check not found on subsequent get
        const checkFolder = await prisma.folders.findUnique({ where: { id: folder.id } });
        assert.strictEqual(checkFolder, null);
    });

    await t.test("Add & Remove System Vocabulary & Get Contents", async () => {
        const user = await createAuthenticatedUser("user@example.com");

        // 1. Tạo folder mẫu
        const folder = await prisma.folders.create({
            data: { id: crypto.randomUUID(), user_id: user.id, name: "Vocab collection" }
        });

        // 2. Tạo từ vựng hệ thống
        const vocabId = crypto.randomUUID();
        await prisma.vocabularies.create({
            data: {
                id: vocabId,
                kanji: "飲む",
                hiragana: "のむ",
                jlpt: "N5",
                vocabulary_meanings: {
                    create: { id: crypto.randomUUID(), language: "vi", meaning: "uống" }
                }
            }
        });

        // 3. Thêm từ vựng hệ thống vào folder
        const addRes = await app.inject({
            method: "POST",
            url: `/api/v1/folders/${folder.id}/system-vocabularies`,
            headers: { Authorization: `Bearer ${user.token}` },
            payload: { vocabulary_id: vocabId }
        });
        assert.strictEqual(addRes.statusCode, 201);

        // 4. Lấy nội dung folder
        const contentsRes = await app.inject({
            method: "GET",
            url: `/api/v1/folders/${folder.id}/contents`,
            headers: { Authorization: `Bearer ${user.token}` }
        });
        assert.strictEqual(contentsRes.statusCode, 200);
        const contentsBody = JSON.parse(contentsRes.body);
        assert.strictEqual(contentsBody.success, true);
        assert.strictEqual(contentsBody.data.system_vocabularies.length, 1);
        assert.strictEqual(contentsBody.data.system_vocabularies[0].kanji, "飲む");
        assert.strictEqual(contentsBody.data.system_vocabularies[0].meaning, "uống");

        // 5. Xóa từ vựng hệ thống khỏi folder
        const removeRes = await app.inject({
            method: "DELETE",
            url: `/api/v1/folders/${folder.id}/system-vocabularies/${vocabId}`,
            headers: { Authorization: `Bearer ${user.token}` }
        });
        assert.strictEqual(removeRes.statusCode, 200);

        // 6. Lấy lại nội dung folder để xác nhận đã trống
        const contentsRes2 = await app.inject({
            method: "GET",
            url: `/api/v1/folders/${folder.id}/contents`,
            headers: { Authorization: `Bearer ${user.token}` }
        });
        const contentsBody2 = JSON.parse(contentsRes2.body);
        assert.strictEqual(contentsBody2.data.system_vocabularies.length, 0);
    });

    await t.test("Add & Remove User Vocabulary & Get Contents", async () => {
        const user = await createAuthenticatedUser("user@example.com");

        const folder = await prisma.folders.create({
            data: { id: crypto.randomUUID(), user_id: user.id, name: "Custom Vocab" }
        });

        // Tạo từ vựng cá nhân
        const userVocabId = crypto.randomUUID();
        await prisma.user_vocabularies.create({
            data: {
                id: userVocabId,
                user_id: user.id,
                kanji: "本",
                hiragana: "ほん",
                meaning: "sách",
                note: "Từ quan trọng"
            }
        });

        // Thêm vào folder
        const addRes = await app.inject({
            method: "POST",
            url: `/api/v1/folders/${folder.id}/user-vocabularies`,
            headers: { Authorization: `Bearer ${user.token}` },
            payload: { user_vocabulary_id: userVocabId }
        });
        assert.strictEqual(addRes.statusCode, 201);

        // Lấy nội dung
        const contentsRes = await app.inject({
            method: "GET",
            url: `/api/v1/folders/${folder.id}/contents`,
            headers: { Authorization: `Bearer ${user.token}` }
        });
        assert.strictEqual(contentsRes.statusCode, 200);
        const contentsBody = JSON.parse(contentsRes.body);
        assert.strictEqual(contentsBody.data.user_vocabularies.length, 1);
        assert.strictEqual(contentsBody.data.user_vocabularies[0].kanji, "本");
        assert.strictEqual(contentsBody.data.user_vocabularies[0].note, "Từ quan trọng");

        // Xóa khỏi folder
        const removeRes = await app.inject({
            method: "DELETE",
            url: `/api/v1/folders/${folder.id}/user-vocabularies/${userVocabId}`,
            headers: { Authorization: `Bearer ${user.token}` }
        });
        assert.strictEqual(removeRes.statusCode, 200);
    });
});
