import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { kanjiService } from "../../src/modules/kanji/kanji.service.js";
import { kanjiRepository } from "../../src/modules/kanji/kanji.repository.js";
import { db } from "../../src/config/prisma.js";

const originalPrisma = db.prisma;

test("Kanji Service - Unit Tests", async (t) => {
    beforeEach(() => {
        mock.restoreAll();
        
        db.prisma = {
            kanjis: originalPrisma.kanjis,
            $transaction: async (callback: any) => {
                return callback(db.prisma);
            }
        } as any;
    });

    afterEach(() => {
        db.prisma = originalPrisma;
    });

    await t.test("listKanji - success with default and filters", async () => {
        const mockKanjis = [
            {
                id: "kanji-id-1",
                kanji: "日",
                meaning: "Mặt trời",
                onyomi: "ニチ",
                kunyomi: "ひ",
                stroke_count: 4,
                jlpt: "N5",
                radical: "日",
                stroke_order_image_url: "url",
                examples: [],
                created_at: new Date(),
                deleted_at: null,
            }
        ];

        const findFilteredMock = mock.method(kanjiRepository, "findFiltered", async () => {
            return { items: mockKanjis, total: 1 };
        });

        const result = await kanjiService.listKanji({ page: 1, limit: 10 });
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.length, 1);
        assert.strictEqual(result.data[0].character, "日");
        assert.strictEqual(result.data[0].meaning_vi, "Mặt trời");
        assert.strictEqual(result.data[0].onyomi, "ニチ");
        assert.strictEqual(result.data[0].kunyomi, "ひ");
        assert.strictEqual(result.data[0].stroke_count, 4);
        assert.strictEqual(result.data[0].jlpt_level, "N5");
        assert.strictEqual(result.data[0].is_saved, false);
        assert.deepStrictEqual(result.meta, {
            page: 1,
            limit: 10,
            total: 1,
            total_pages: 1,
        });
        assert.strictEqual(findFilteredMock.mock.callCount(), 1);
    });

    await t.test("listKanji - throw INVALID_STROKE_RANGE if min > max", async () => {
        await assert.rejects(
            kanjiService.listKanji({ min_strokes: 10, max_strokes: 5 }),
            /min_strokes must not exceed max_strokes/
        );
    });

    await t.test("getKanjiDetail - success", async () => {
        const mockKanji = {
            id: "kanji-id-1",
            kanji: "本",
            meaning: "Sách, gốc",
            onyomi: "ホン",
            kunyomi: "moto",
            stroke_count: 5,
            jlpt: "N5",
            radical: "木",
            stroke_order_image_url: "url2",
            examples: [{ word_jp: "日本語", reading: "にほんご", meaning_vi: "Tiếng Nhật" }],
            created_at: new Date(),
            deleted_at: null,
        };

        const findByIdMock = mock.method(kanjiRepository, "findById", async () => mockKanji);

        const result = await kanjiService.getKanjiDetail("kanji-id-1");
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.character, "本");
        assert.strictEqual(result.data.meaning_vi, "Sách, gốc");
        assert.strictEqual(result.data.radical, "木");
        assert.strictEqual(result.data.stroke_order_image_url, "url2");
        assert.deepStrictEqual(result.data.examples, [{ word_jp: "日本語", reading: "にほんご", meaning_vi: "Tiếng Nhật" }]);
        assert.strictEqual(findByIdMock.mock.callCount(), 1);
    });

    await t.test("getKanjiDetail - throw KANJI_NOT_FOUND when not exists", async () => {
        mock.method(kanjiRepository, "findById", async () => null);

        await assert.rejects(
            kanjiService.getKanjiDetail("some-id"),
            /Kanji not found/
        );
    });

    await t.test("createKanji - success", async () => {
        const mockCreated = {
            id: "new-uuid",
            kanji: "学",
            meaning: "Học",
            onyomi: "ガク",
            kunyomi: "mana.bu",
            stroke_count: 8,
            jlpt: "N5",
            radical: "子",
            stroke_order_image_url: "url3",
            examples: [],
            created_at: new Date(),
            deleted_at: null,
        };

        const findDuplicateMock = mock.method(kanjiRepository, "findDuplicate", async () => null);
        const existsLessonMock = mock.method(kanjiRepository, "existsLesson", async () => true);
        const createMock = mock.method(kanjiRepository, "create", async () => mockCreated);

        const result = await kanjiService.createKanji("admin-id", {
            character: "学",
            meaning_vi: "Học",
            onyomi: "ガク",
            kunyomi: "mana.bu",
            stroke_count: 8,
            jlpt_level: "N5",
            radical: "子",
            stroke_order_image_url: "url3",
            examples: [],
            lesson_id: "lesson-id",
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.character, "学");
        assert.strictEqual(result.message, "Kanji created successfully.");
        assert.strictEqual(findDuplicateMock.mock.callCount(), 1);
        assert.strictEqual(existsLessonMock.mock.callCount(), 1);
        assert.strictEqual(createMock.mock.callCount(), 1);
    });

    await t.test("createKanji - throw DUPLICATE_KANJI when character already exists", async () => {
        mock.method(kanjiRepository, "findDuplicate", async () => ({ id: "existing-id" }));

        await assert.rejects(
            kanjiService.createKanji("admin-id", {
                character: "学",
                meaning_vi: "Học",
                stroke_count: 8,
                jlpt_level: "N5",
            }),
            /This kanji character already exists/
        );
    });

    await t.test("createKanji - throw INVALID_LESSON_REFERENCE when lesson does not exist", async () => {
        mock.method(kanjiRepository, "findDuplicate", async () => null);
        mock.method(kanjiRepository, "existsLesson", async () => false);

        await assert.rejects(
            kanjiService.createKanji("admin-id", {
                character: "学",
                meaning_vi: "Học",
                stroke_count: 8,
                jlpt_level: "N5",
                lesson_id: "non-existent-lesson-id",
            }),
            /Referenced lesson does not exist/
        );
    });

    await t.test("updateKanji - success", async () => {
        const mockExisting = {
            id: "kanji-id",
            kanji: "学",
            meaning: "Học",
            onyomi: "ガク",
            kunyomi: "mana.bu",
            stroke_count: 8,
            jlpt: "N5",
            radical: "子",
            stroke_order_image_url: "url3",
            examples: [],
            created_at: new Date(),
            deleted_at: null,
        };

        const mockUpdated = {
            id: "kanji-id",
            kanji: "学",
            meaning: "Học tập",
            onyomi: "ガク",
            kunyomi: "mana.bu",
            stroke_count: 8,
            jlpt: "N5",
            radical: "子",
            stroke_order_image_url: "url3",
            examples: [],
            created_at: new Date(),
            deleted_at: null,
        };

        const findByIdMock = mock.method(kanjiRepository, "findById", async () => mockExisting);
        const findDuplicateMock = mock.method(kanjiRepository, "findDuplicate", async () => null);
        const updateMock = mock.method(kanjiRepository, "update", async () => mockUpdated);

        const result = await kanjiService.updateKanji("admin-id", "kanji-id", {
            meaning_vi: "Học tập",
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.data.id, "kanji-id");
        assert.strictEqual(result.message, "Kanji updated successfully.");
        assert.strictEqual(findByIdMock.mock.callCount(), 1);
        assert.strictEqual(findDuplicateMock.mock.callCount(), 0); // No character change, so no duplicate check needed
        assert.strictEqual(updateMock.mock.callCount(), 1);
    });

    await t.test("updateKanji - throw KANJI_NOT_FOUND when not exists", async () => {
        mock.method(kanjiRepository, "findById", async () => null);

        await assert.rejects(
            kanjiService.updateKanji("admin-id", "non-existent-id", { meaning_vi: "Học" }),
            /Kanji not found/
        );
    });

    await t.test("updateKanji - throw EMPTY_UPDATE when no fields provided", async () => {
        mock.method(kanjiRepository, "findById", async () => ({ id: "id" }));

        await assert.rejects(
            kanjiService.updateKanji("admin-id", "kanji-id", {}),
            /At least one field must be provided/
        );
    });

    await t.test("updateKanji - throw DUPLICATE_KANJI when character changes and duplicates", async () => {
        const mockExisting = {
            id: "kanji-id",
            kanji: "学",
            meaning: "Học",
            stroke_count: 8,
            jlpt: "N5",
        };

        mock.method(kanjiRepository, "findById", async () => mockExisting);
        mock.method(kanjiRepository, "findDuplicate", async () => ({ id: "other-id" }));

        await assert.rejects(
            kanjiService.updateKanji("admin-id", "kanji-id", { character: "校" }),
            /This kanji character already exists/
        );
    });

    await t.test("deleteKanji - success", async () => {
        mock.method(kanjiRepository, "findById", async () => ({ id: "kanji-id" }));
        const softDeleteMock = mock.method(kanjiRepository, "softDelete", async () => ({ id: "kanji-id" }));

        const result = await kanjiService.deleteKanji("admin-id", "kanji-id");
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, "Kanji deleted successfully.");
        assert.strictEqual(softDeleteMock.mock.callCount(), 1);
    });

    await t.test("deleteKanji - throw KANJI_NOT_FOUND when not exists", async () => {
        mock.method(kanjiRepository, "findById", async () => null);

        await assert.rejects(
            kanjiService.deleteKanji("admin-id", "non-existent-id"),
            /Kanji not found/
        );
    });
});
