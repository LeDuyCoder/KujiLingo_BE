import { test, beforeEach, after } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";
import app from "../../src/app.js";
import { prisma } from "../../src/config/prisma.js";

async function clearDatabase() {
    await prisma.vocabulary_meanings.deleteMany({});
    await prisma.vocabularies.deleteMany({});
}

test("Dictionary API - Database Integration Tests", async (t) => {
    beforeEach(async () => {
        await clearDatabase();
    });

    after(async () => {
        await clearDatabase();
    });

    await t.test("GET /dictionary/search - success with matches", async () => {
        const vocabId = crypto.randomUUID();

        // 1. Tạo từ vựng mẫu
        await prisma.vocabularies.create({
            data: {
                id: vocabId,
                kanji: "少ない",
                hiragana: "すくない",
                romaji: "sukunai",
                word_type: "I_ADJECTIVE",
                jlpt: "N5",
                frequency: 1,
                vocabulary_meanings: {
                    createMany: {
                        data: [
                            { id: crypto.randomUUID(), language: "vi", meaning: "ít, vắng vẻ" },
                            { id: crypto.randomUUID(), language: "en", meaning: "few, little" }
                        ]
                    }
                }
            }
        });

        // 2. Gọi API Search
        const res = await app.inject({
            method: "GET",
            url: "/dictionary/search?q=少ない&limit=20"
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);

        assert.strictEqual(body.success, true);
        assert.ok(Array.isArray(body.data));
        assert.strictEqual(body.data.length, 1);

        // Kiểm định cấu trúc DTO
        const entry = body.data[0];
        assert.strictEqual(entry.id, vocabId);
        assert.strictEqual(entry.term_jp, "少ない");
        assert.strictEqual(entry.reading_hiragana, "すくない");
        assert.strictEqual(entry.meaning_vi, "ít, vắng vẻ");
        assert.strictEqual(entry.meaning_en, "few, little");
        assert.strictEqual(entry.part_of_speech, "I_ADJECTIVE");
        assert.strictEqual(entry.jlpt_level, "N5");
        assert.strictEqual(entry.is_favorited, false);
        assert.strictEqual(entry.is_saved, false);

        // Kiểm định Meta
        assert.strictEqual(body.meta.page, 1);
        assert.strictEqual(body.meta.limit, 20);
        assert.strictEqual(body.meta.total, 1);
        assert.strictEqual(body.meta.total_pages, 1);
    });

    await t.test("GET /dictionary/:id - success with detail", async () => {
        const vocabId = crypto.randomUUID();

        // 1. Tạo từ vựng mẫu
        await prisma.vocabularies.create({
            data: {
                id: vocabId,
                kanji: "少ない",
                hiragana: "すくない",
                romaji: "sukunai",
                word_type: "I_ADJECTIVE",
                jlpt: "N5",
                frequency: 1,
                vocabulary_meanings: {
                    createMany: {
                        data: [
                            { id: crypto.randomUUID(), language: "vi", meaning: "ít, vắng vẻ" }
                        ]
                    }
                }
            }
        });

        // 2. Gọi API Details
        const res = await app.inject({
            method: "GET",
            url: `/dictionary/${vocabId}`
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);

        assert.strictEqual(body.success, true);
        assert.strictEqual(body.data.id, vocabId);
        assert.strictEqual(body.data.term_jp, "少ない");
        assert.ok(body.data.vocabulary);
        assert.strictEqual(body.data.vocabulary.id, vocabId);
    });

    await t.test("GET /dictionary/search - fallback to Jisho API on empty DB", async () => {
        // Gọi API tìm kiếm với từ khóa "食べる" không có trong DB trống
        const res = await app.inject({
            method: "GET",
            url: "/dictionary/search?q=食べる&limit=5"
        });

        assert.strictEqual(res.statusCode, 200);
        const body = JSON.parse(res.body);

        assert.strictEqual(body.success, true);
        assert.ok(Array.isArray(body.data));
        assert.ok(body.data.length > 0);

        // Kiểm tra xem từ "食べる" (hoặc biến thể của nó) đã được crawl thành công chưa
        const entry = body.data[0];
        assert.ok(entry.term_jp.includes("食べる") || entry.reading_hiragana.includes("たべる"));
        assert.strictEqual(entry.is_favorited, false);
        assert.strictEqual(entry.is_saved, false);

        // Kiểm tra DB thực tế xem từ đã được lưu chưa
        const savedInDb = await prisma.vocabularies.findFirst({
            where: {
                OR: [
                    { kanji: "食べる" },
                    { hiragana: "たべる" }
                ]
            }
        });
        assert.ok(savedInDb);
    });
});
